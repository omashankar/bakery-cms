/**
 * NOBODY CAN HAND OUT MORE THAN THEY HOLD, AND NOBODY CAN LOCK THE SHOP OUT.
 *
 * "Manage members" given to a manager must not be "make yourself owner"; an
 * owner must not be able to block, demote or remove the last active owner,
 * themselves included. These are the pure rules the team service checks before
 * every change — the transaction re-counts owners on top of them.
 */
import { describe, expect, it } from "vitest";

import { ALL_PERMISSIONS, type Permission } from "@/features/team/lib/permissions";
import {
  assertCanEditRole,
  assertCanGrantRole,
  assertCanManageMember,
  assertOwnersRemain,
  reducesActiveOwners,
  slugForRoleName,
  type PolicyActor,
} from "@/features/team/server/team.policy";

const owner: PolicyActor = { sub: "o1", role: "owner", isOwner: true, permissions: new Set(ALL_PERMISSIONS) };
const managerPerms: Permission[] = ["team.view", "team.manage", "team.invite", "roles.view", "roles.manage", "orders.view", "products.view"];
const lead: PolicyActor = { sub: "m1", role: "shift-lead", isOwner: false, permissions: new Set(managerPerms) };

describe("granting a role", () => {
  it("only an owner can make an owner", () => {
    expect(() => assertCanGrantRole(lead, { slug: "owner", permissions: ALL_PERMISSIONS })).toThrow(/Only an owner/);
    expect(() => assertCanGrantRole(owner, { slug: "owner", permissions: ALL_PERMISSIONS })).not.toThrow();
  });

  it("a non-owner cannot give a role with more access than their own", () => {
    expect(() => assertCanGrantRole(lead, { slug: "x", permissions: ["orders.view", "orders.refund"] })).toThrow(/more access/);
    expect(() => assertCanGrantRole(lead, { slug: "y", permissions: ["orders.view"] })).not.toThrow();
  });
});

describe("changing a member", () => {
  it("nobody changes their own role or access from the team screen", () => {
    expect(() => assertCanManageMember(owner, { id: "o1", role: "owner" }, ALL_PERMISSIONS)).toThrow(/your own/);
  });

  it("only an owner changes an owner", () => {
    expect(() => assertCanManageMember(lead, { id: "o2", role: "owner" }, ALL_PERMISSIONS)).toThrow(/Only an owner/);
    expect(() => assertCanManageMember(owner, { id: "o2", role: "owner" }, ALL_PERMISSIONS)).not.toThrow();
  });

  it("a non-owner cannot change someone with more access", () => {
    expect(() => assertCanManageMember(lead, { id: "a", role: "accountant" }, ["payments.refund", "payments.view"])).toThrow(/more access/);
    expect(() => assertCanManageMember(lead, { id: "b", role: "packer" }, ["orders.view"])).not.toThrow();
  });
});

describe("editing a role", () => {
  it("the owner role is never edited", () => {
    expect(() => assertCanEditRole(owner, { slug: "owner" }, ["orders.view"])).toThrow(/Owner role/);
  });

  it("a non-owner cannot widen the role they hold themselves", () => {
    expect(() => assertCanEditRole(lead, { slug: "shift-lead" }, ["orders.view"])).toThrow(/your own role/);
  });

  it("a non-owner cannot put a permission they lack into a role", () => {
    expect(() => assertCanEditRole(lead, { slug: "packer" }, ["orders.view", "orders.refund"])).toThrow(/don't have/);
  });

  it("an invalid combination is refused with the reason", () => {
    expect(() => assertCanEditRole(owner, { slug: "packer" }, ["products.delete"])).toThrow(/also needs/);
    expect(() => assertCanEditRole(owner, { slug: "packer" }, ["orders.made_up"])).toThrow(/not a permission/);
  });
});

describe("the last active owner", () => {
  it("demoting, deactivating, blocking or removing an active owner reduces the owners", () => {
    const o = { role: "owner", status: "active" };
    expect(reducesActiveOwners(o, { role: "manager" })).toBe(true);
    expect(reducesActiveOwners(o, { status: "inactive" })).toBe(true);
    expect(reducesActiveOwners(o, { status: "blocked" })).toBe(true);
    expect(reducesActiveOwners(o, { removed: true })).toBe(true);
    expect(reducesActiveOwners(o, { status: "active" })).toBe(false);
  });

  it("changing someone who is not an active owner does not", () => {
    expect(reducesActiveOwners({ role: "manager", status: "active" }, { removed: true })).toBe(false);
    expect(reducesActiveOwners({ role: "owner", status: "blocked" }, { removed: true })).toBe(false);
  });

  it("a change that would leave none is refused", () => {
    expect(() => assertOwnersRemain(0)).toThrow(/at least one active owner/);
    expect(() => assertOwnersRemain(1)).not.toThrow();
  });
});

describe("naming a custom role", () => {
  it("makes a readable, unique slug and never takes a reserved name", () => {
    expect(slugForRoleName("Head Baker", new Set())).toBe("head-baker");
    expect(slugForRoleName("Head Baker", new Set(["head-baker"]))).toBe("head-baker-2");
    expect(slugForRoleName("Owner", new Set())).toBe("owner-2");
    expect(slugForRoleName("Admin", new Set())).toBe("admin-2");
    expect(slugForRoleName("!!!", new Set())).toBe("role");
  });
});
