/**
 * A BLOCKED MEMBER IS OUT ON THEIR NEXT REQUEST, AND A ROLE CHANGE APPLIES ON
 * THE NEXT CLICK.
 *
 * The access token lives for the shop's whole session timeout and carries the
 * role the member had when they signed in. Authorising from it would leave a
 * blocked member working, and a demoted one with their old powers, until it
 * expired. lib/server/auth/access.ts reads the account's status and role from
 * the database instead — behind a short cache that every team change clears.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: null as null | { sub: string; role: string; email: string },
  users: new Map<string, { email: string; name: string; role: string; status: string }>(),
  roles: [] as Array<{ slug: string; name: string; permissions: string[] }>,
  userReads: 0,
}));

vi.mock("@/lib/server/auth/dal", () => ({ getSession: async () => state.session }));
vi.mock("@/lib/server/db/mongoose", () => ({ connectDB: async () => undefined }));
vi.mock("@/lib/server/db/models/user.model", () => ({
  UserModel: {
    findById: (id: string) => ({
      select: () => ({
        lean: async () => {
          state.userReads += 1;
          const u = state.users.get(id);
          return u ? { ...u } : null;
        },
      }),
    }),
  },
}));
vi.mock("@/lib/server/db/models/role.model", () => ({
  RoleModel: {
    find: () => ({ select: () => ({ lean: async () => state.roles.map((r) => ({ ...r })) }) }),
    bulkWrite: async () => undefined,
  },
}));
// `cache()` memoises per request in React; across these "requests" it must not.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import {
  getActor,
  invalidateAccessCache,
  requirePermission,
  whenAllowed,
} from "@/lib/server/auth/access";
import { SYSTEM_ROLES } from "@/features/team/lib/permissions";

beforeEach(() => {
  invalidateAccessCache();
  state.session = { sub: "m1", role: "manager", email: "m@example.com" };
  state.users = new Map([["m1", { email: "m@example.com", name: "Meera", role: "manager", status: "active" }]]);
  state.roles = SYSTEM_ROLES.map((r) => ({ slug: r.slug, name: r.name, permissions: [...r.permissions] }));
  state.userReads = 0;
});

describe("who the request is from", () => {
  it("is 401 with no session, and 403 for a signed-in member without the permission", async () => {
    state.session = null;
    await expect(requirePermission("orders.view")).rejects.toMatchObject({ status: 401 });
    state.session = { sub: "m1", role: "manager", email: "m@example.com" };
    await expect(requirePermission("orders.refund")).rejects.toMatchObject({ status: 403 });
    await expect(requirePermission("orders.view")).resolves.toMatchObject({ sub: "m1" });
  });

  it("a blocked or deactivated account is a 401 at once, whatever its token says", async () => {
    await expect(requirePermission("orders.view")).resolves.toBeTruthy();
    state.users.get("m1")!.status = "blocked";
    invalidateAccessCache("m1"); // what the team service does on every change
    await expect(requirePermission("orders.view")).rejects.toMatchObject({ status: 401 });
    expect(await getActor()).toBeNull();
  });

  it("a removed account is a 401 too", async () => {
    state.users.delete("m1");
    await expect(requirePermission("orders.view")).rejects.toMatchObject({ status: 401 });
  });

  it("the role comes from the account, not the token", async () => {
    state.session = { sub: "m1", role: "owner", email: "m@example.com" }; // a token that claims owner
    await expect(requirePermission("team.manage")).rejects.toMatchObject({ status: 403 });
  });

  it("a role change applies on the next request once the cache is cleared", async () => {
    await expect(requirePermission("orders.view")).resolves.toBeTruthy();
    state.users.get("m1")!.role = "kitchen-staff";
    invalidateAccessCache("m1");
    await expect(requirePermission("orders.view")).rejects.toMatchObject({ status: 403 });
    await expect(requirePermission("orders.view_kitchen")).resolves.toBeTruthy();
  });

  it("a change to the ROLE applies to everyone holding it", async () => {
    state.roles.find((r) => r.slug === "manager")!.permissions.push("orders.refund");
    invalidateAccessCache();
    await expect(requirePermission("orders.refund")).resolves.toBeTruthy();
  });

  it("repeat requests inside the cache window do not re-read the account", async () => {
    await requirePermission("orders.view");
    await requirePermission("orders.view");
    await requirePermission("orders.view");
    expect(state.userReads).toBe(1);
  });
});

describe("data rendered into a page", () => {
  it("is read only for a member allowed it — otherwise not even fetched", async () => {
    const read = vi.fn(async () => "secret revenue");
    state.users.get("m1")!.role = "kitchen-staff";
    invalidateAccessCache();
    expect(await whenAllowed("reports.revenue.view", read)).toBeNull();
    expect(read).not.toHaveBeenCalled();
    expect(await whenAllowed(["orders.view", "orders.view_kitchen"], read)).toBe("secret revenue");
  });
});
