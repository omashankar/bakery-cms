/**
 * A stand-in for lib/server/auth/access.ts in tests that exercise a controller
 * without a database: the caller is whoever `as` names, and the permission
 * checks are the REAL rule (all-of / any-of over that member's permissions),
 * so a controller asking for the wrong permission still fails its test.
 *
 *   vi.mock("@/lib/server/auth/access", async () =>
 *     (await import("@/tests/stubs/access")).accessStub(() => signedIn.actor));
 */
import { ALL_PERMISSIONS, type Permission } from "@/features/team/lib/permissions";
import { AuthError, ForbiddenError } from "@/lib/server/http/errors";

export interface StubActor {
  sub: string;
  email: string;
  name: string;
  role: string;
  roleName: string;
  isOwner: boolean;
  permissions: ReadonlySet<Permission>;
}

export function ownerActor(overrides: Partial<StubActor> = {}): StubActor {
  return {
    sub: "u1",
    email: "owner@example.com",
    name: "Owner",
    role: "owner",
    roleName: "Owner",
    isOwner: true,
    permissions: new Set(ALL_PERMISSIONS),
    ...overrides,
  };
}

export function memberActor(permissions: Permission[], overrides: Partial<StubActor> = {}): StubActor {
  return {
    sub: "m1",
    email: "member@example.com",
    name: "Member",
    role: "custom",
    roleName: "Custom",
    isOwner: false,
    permissions: new Set(permissions),
    ...overrides,
  };
}

export function accessStub(current: () => StubActor | null) {
  const requireActor = async () => {
    const actor = current();
    if (!actor) throw new AuthError();
    return actor;
  };
  const has = (actor: StubActor | null, p: Permission) => Boolean(actor?.permissions.has(p));
  return {
    getActor: async () => current(),
    requireActor,
    requireStaff: requireActor,
    requirePermission: async (...ps: Permission[]) => {
      const actor = await requireActor();
      if (!ps.every((p) => has(actor, p))) throw new ForbiddenError();
      return actor;
    },
    requireAnyPermission: async (...ps: Permission[]) => {
      const actor = await requireActor();
      if (!ps.some((p) => has(actor, p))) throw new ForbiddenError();
      return actor;
    },
    can: (actor: StubActor | null, p: Permission) => has(actor, p),
    canAny: (actor: StubActor | null, ps: Permission[]) => ps.some((p) => has(actor, p)),
    invalidateAccessCache: () => undefined,
    whenAllowed: async <T>(need: Permission | Permission[], read: (a: StubActor) => Promise<T>) => {
      const actor = current();
      const list = typeof need === "string" ? [need] : need;
      return actor && list.some((p) => has(actor, p)) ? read(actor) : null;
    },
    whenStaff: async <T>(read: (a: StubActor) => Promise<T>) => {
      const actor = current();
      return actor ? read(actor) : null;
    },
  };
}
