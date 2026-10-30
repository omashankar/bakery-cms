import { ConflictError, ForbiddenError, ValidationError } from "@/lib/server/http/errors";
import {
  isOwnerRole,
  permissionProblems,
  type Permission,
} from "@/features/team/lib/permissions";

/**
 * The rules about who may change whom — pure, so they can be tested without a
 * database and cannot be skipped by a caller that forgets a lookup.
 *
 * Three ideas, everywhere:
 *
 * 1. NO ESCALATION. Someone who is not an owner can never hand out — to
 *    another member, or to a role — a permission they do not hold themselves.
 *    Otherwise "Manage members" would be "make yourself anything".
 * 2. OWNERS ARE THE OWNERS' BUSINESS. Only an owner may make an owner, or
 *    change, block or remove one.
 * 3. NOBODY LOCKS THE SHOP OUT. Your own account is not changed from the Team
 *    screen, and the last active owner cannot be demoted, deactivated, blocked
 *    or removed by anyone.
 */

export interface PolicyActor {
  sub: string;
  role: string;
  isOwner: boolean;
  permissions: ReadonlySet<Permission>;
}

export interface PolicyMember {
  id: string;
  role: string;
}

export interface PolicyRole {
  slug: string;
  isSystem?: boolean;
  permissions: readonly string[];
}

function exceeds(actor: PolicyActor, permissions: Iterable<string>): string[] {
  return [...permissions].filter((p) => !actor.permissions.has(p as Permission));
}

/** May `actor` give `role` to someone (invite them with it, or move them to it)? */
export function assertCanGrantRole(actor: PolicyActor, role: PolicyRole): void {
  if (isOwnerRole(role.slug)) {
    if (!actor.isOwner) throw new ForbiddenError("Only an owner can make someone an owner.");
    return;
  }
  if (!actor.isOwner && exceeds(actor, role.permissions).length > 0) {
    throw new ForbiddenError("You can't give someone a role with more access than your own.");
  }
}

/**
 * May `actor` change, block or remove `member` at all? `memberPermissions` is
 * what the member's CURRENT role grants.
 */
export function assertCanManageMember(
  actor: PolicyActor,
  member: PolicyMember,
  memberPermissions: Iterable<string>,
): void {
  if (member.id === actor.sub) {
    throw new ForbiddenError(
      "You can't change your own role or access here. Ask another owner to do it.",
    );
  }
  if (isOwnerRole(member.role)) {
    if (!actor.isOwner) throw new ForbiddenError("Only an owner can change another owner.");
    return;
  }
  if (!actor.isOwner && exceeds(actor, memberPermissions).length > 0) {
    throw new ForbiddenError("You can't change a member who has more access than you.");
  }
}

/** May `actor` set `role`'s permissions to `next`? Validates `next` too. */
export function assertCanEditRole(
  actor: PolicyActor,
  role: Pick<PolicyRole, "slug">,
  next: readonly string[],
): void {
  if (isOwnerRole(role.slug)) {
    throw new ForbiddenError("The Owner role always has full access. It can't be edited.");
  }
  assertValidPermissions(next);
  if (actor.isOwner) return;
  if (actor.role === role.slug) {
    throw new ForbiddenError("You can't change the permissions of your own role.");
  }
  const over = exceeds(actor, next);
  if (over.length > 0) {
    throw new ForbiddenError("You can't give a role a permission you don't have yourself.");
  }
}

export function assertValidPermissions(list: readonly string[]): void {
  const problems = permissionProblems(list);
  if (problems.length > 0) {
    throw new ValidationError(
      problems.map((p) => ({ field: "permissions", message: p.message })),
      problems[0].message,
    );
  }
}

/**
 * Called with the number of active owners there WOULD be after the change,
 * counted inside the change's own transaction.
 */
export function assertOwnersRemain(activeOwnersAfter: number): void {
  if (activeOwnersAfter < 1) {
    throw new ConflictError(
      "The shop must always have at least one active owner. Make someone else an owner first.",
    );
  }
}

/** Would this change take an ACTIVE OWNER away? Then the count must be checked. */
export function reducesActiveOwners(
  member: { role: string; status: string },
  next: { role?: string; status?: string; removed?: boolean },
): boolean {
  const wasActiveOwner = isOwnerRole(member.role) && member.status === "active";
  if (!wasActiveOwner) return false;
  if (next.removed) return true;
  const role = next.role ?? member.role;
  const status = next.status ?? member.status;
  return !(isOwnerRole(role) && status === "active");
}

/** "Head Baker" → "head-baker", made unique against `taken`. */
export function slugForRoleName(name: string, taken: ReadonlySet<string>): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "role";
  // A custom role may not take the name of a role that means something here.
  const reserved = new Set([...taken, "owner", "admin"]);
  if (!reserved.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!reserved.has(candidate)) return candidate;
  }
}
