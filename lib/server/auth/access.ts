import "server-only";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";

import { connectDB } from "@/lib/server/db/mongoose";
import { UserModel } from "@/lib/server/db/models/user.model";
import { RoleModel } from "@/lib/server/db/models/role.model";
import { AuthError, ForbiddenError } from "@/lib/server/http/errors";
import {
  ALL_PERMISSIONS,
  SYSTEM_ROLES,
  isOwnerRole,
  isPermission,
  type Permission,
} from "@/features/team/lib/permissions";

import { getSession } from "./dal";

/**
 * WHO is asking and WHAT they may do — read from the database, not the token.
 *
 * The access token says who signed in and carries the role they had at that
 * moment. It lives for up to the shop's session timeout, so trusting it would
 * mean a member who was just blocked, or moved from Manager to Kitchen Staff,
 * keeps their old powers until it expires. Every check here re-reads the
 * account's status and role instead; the token's `role` claim is never used to
 * authorise anything.
 *
 * Two short in-process caches keep that from costing a database round trip per
 * request (the database is remote). Every write that changes an account or a
 * role calls `invalidateAccessCache`, so on this server the change is
 * immediate; another server process sees it within ACCESS_CACHE_TTL_MS.
 */

export const ACCESS_CACHE_TTL_MS = 10_000;

export interface Actor {
  /** The user id — named like the token's claim, so callers can audit with `actor.sub`. */
  sub: string;
  email: string;
  name: string;
  role: string;
  roleName: string;
  isOwner: boolean;
  permissions: ReadonlySet<Permission>;
}

/** The serialisable form handed to the admin shell. */
export interface AccessSnapshot {
  userId: string;
  email: string;
  name: string;
  role: string;
  roleName: string;
  isOwner: boolean;
  permissions: Permission[];
}

interface StaffRecord {
  email: string;
  name: string;
  role: string;
  status: string;
}

interface RoleRecord {
  slug: string;
  name: string;
  permissions: string[];
}

const userCache = new Map<string, { at: number; value: StaffRecord | null }>();
let rolesCache: { at: number; value: Map<string, RoleRecord> } | null = null;
/**
 * Bumped by every invalidation. A read that STARTED before an invalidation may
 * finish after it, holding the old answer; it must not write that answer back
 * into the cache it was just cleared from.
 */
let generation = 0;

export function invalidateAccessCache(userId?: string): void {
  generation += 1;
  if (userId) userCache.delete(userId);
  else userCache.clear();
  rolesCache = null;
}

async function loadStaff(userId: string): Promise<StaffRecord | null> {
  const hit = userCache.get(userId);
  if (hit && Date.now() - hit.at < ACCESS_CACHE_TTL_MS) return hit.value;

  const started = generation;
  await connectDB();
  let value: StaffRecord | null = null;
  try {
    const doc = await UserModel.findById(userId).select("email name role status").lean();
    value = doc
      ? { email: doc.email, name: doc.name, role: doc.role, status: doc.status ?? "active" }
      : null;
  } catch (error) {
    // A malformed id is "no such account"; anything else is the database
    // failing and must not be cached as an answer.
    if ((error as { name?: string }).name !== "CastError") throw error;
  }
  if (started === generation) userCache.set(userId, { at: Date.now(), value });
  return value;
}

/**
 * Every role, with the default ones put back if they are missing.
 *
 * Inserting here rather than only in a seed script means a fresh database, or
 * one somebody pruned by hand, still has the five roles the Team screen offers.
 * `$setOnInsert` only: a shop that has edited the Manager role's permissions
 * keeps its edit.
 */
export async function loadRoles(): Promise<Map<string, RoleRecord>> {
  if (rolesCache && Date.now() - rolesCache.at < ACCESS_CACHE_TTL_MS) return rolesCache.value;

  const started = generation;
  await connectDB();
  let docs = await RoleModel.find({}).select("slug name permissions").lean();
  const present = new Set(docs.map((d) => d.slug));
  const missing = SYSTEM_ROLES.filter((r) => !present.has(r.slug));
  if (missing.length > 0) {
    await RoleModel.bulkWrite(
      missing.map((role) => ({
        updateOne: {
          filter: { slug: role.slug },
          update: {
            $setOnInsert: {
              slug: role.slug,
              name: role.name,
              description: role.description,
              isSystem: true,
              permissions: [...role.permissions],
            },
          },
          upsert: true,
        },
      })),
    );
    docs = await RoleModel.find({}).select("slug name permissions").lean();
  }

  const value = new Map<string, RoleRecord>(
    docs.map((d) => [d.slug, { slug: d.slug, name: d.name, permissions: d.permissions ?? [] }]),
  );
  if (started === generation) rolesCache = { at: Date.now(), value };
  return value;
}

/**
 * The permissions a role grants.
 *
 * The owner holds every permission whatever is stored for it, so no edit to the
 * roles collection — by a bug, a script or a hand — can lock a shop out of its
 * own admin. Anything else gets exactly what is stored, filtered to ids this
 * build knows: a stored id from an older or newer build grants nothing rather
 * than something.
 */
export function permissionsForRole(
  slug: string,
  roles: ReadonlyMap<string, Pick<RoleRecord, "permissions">>,
): Set<Permission> {
  if (isOwnerRole(slug)) return new Set(ALL_PERMISSIONS);
  const stored = roles.get(slug)?.permissions ?? [];
  return new Set(stored.filter(isPermission));
}

function roleDisplayName(slug: string, roles: ReadonlyMap<string, RoleRecord>): string {
  if (isOwnerRole(slug)) return roles.get("owner")?.name ?? "Owner";
  return roles.get(slug)?.name ?? "No role";
}

/**
 * The signed-in admin, or null — no session, or an account that is no longer
 * active. Memoised for one request.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const session = await getSession();
  if (!session) return null;
  const staff = await loadStaff(session.sub);
  if (!staff || staff.status !== "active") return null;
  const roles = await loadRoles();
  return {
    sub: session.sub,
    email: staff.email,
    name: staff.name,
    role: staff.role,
    roleName: roleDisplayName(staff.role, roles),
    isOwner: isOwnerRole(staff.role),
    permissions: permissionsForRole(staff.role, roles),
  };
});

/**
 * 401 when nobody is signed in OR the account has been blocked, deactivated or
 * removed — the browser treats 401 as "your session is over", which is the
 * truth for a blocked member. 403 is kept for "signed in, but not allowed".
 */
export async function requireActor(): Promise<Actor> {
  const session = await getSession();
  if (!session) throw new AuthError();
  const actor = await getActor();
  if (!actor) throw new AuthError("This account is no longer active");
  return actor;
}

export function can(actor: Pick<Actor, "permissions"> | null | undefined, permission: Permission): boolean {
  return Boolean(actor?.permissions.has(permission));
}

export function canAny(
  actor: Pick<Actor, "permissions"> | null | undefined,
  permissions: readonly Permission[],
): boolean {
  return permissions.some((p) => can(actor, p));
}

/** Throws 401/403 unless the caller holds EVERY permission listed. */
export async function requirePermission(...permissions: Permission[]): Promise<Actor> {
  const actor = await requireActor();
  if (!permissions.every((p) => actor.permissions.has(p))) throw new ForbiddenError();
  return actor;
}

/** Throws 401/403 unless the caller holds AT LEAST ONE of the permissions listed. */
export async function requireAnyPermission(...permissions: Permission[]): Promise<Actor> {
  const actor = await requireActor();
  if (!canAny(actor, permissions)) throw new ForbiddenError();
  return actor;
}

/** Any active team member, whatever their role — for reads every admin screen needs. */
export async function requireStaff(): Promise<Actor> {
  return requireActor();
}

export function toAccessSnapshot(actor: Actor): AccessSnapshot {
  return {
    userId: actor.sub,
    email: actor.email,
    name: actor.name,
    role: actor.role,
    roleName: actor.roleName,
    isOwner: actor.isOwner,
    permissions: ALL_PERMISSIONS.filter((p) => actor.permissions.has(p)),
  };
}

/**
 * Like `whenAllowed`, for any active member — ONLY for a read that is itself
 * shaped by the actor it is given (the settings minus what this person may not
 * see; their own profile). If the read does not look at `actor`, it needs a
 * permission and belongs in `whenAllowed`.
 */
export async function whenStaff<T>(read: (actor: Actor) => Promise<T>): Promise<T | null> {
  try {
    const actor = await getActor();
    if (!actor) return null;
    return await read(actor);
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

/**
 * A screen's first data, read on the server so it arrives in the HTML — but
 * only for someone allowed to see it.
 *
 * `need` is any-of. Null when nobody is signed in, the caller lacks every
 * permission listed, or the read fails: the screen then fetches as it always
 * did, and that fetch meets the API's own check. Rendering data into the HTML
 * IS sending it to the browser, so this is a security boundary, not an
 * optimisation, and the permission is required — there is deliberately no
 * "any admin" form.
 */
export async function whenAllowed<T>(
  need: Permission | readonly Permission[],
  read: (actor: Actor) => Promise<T>,
): Promise<T | null> {
  try {
    const actor = await getActor();
    if (!actor) return null;
    const list = typeof need === "string" ? [need] : need;
    if (!canAny(actor, list)) return null;
    return await read(actor);
  } catch (error) {
    // Next's own interrupts (a request-time API read while prerendering, a
    // redirect, notFound) are not a failed read and must reach Next.
    unstable_rethrow(error);
    return null;
  }
}
