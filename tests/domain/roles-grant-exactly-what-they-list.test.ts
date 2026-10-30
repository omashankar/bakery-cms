/**
 * A ROLE GRANTS EXACTLY WHAT IT LISTS — and the owner always holds everything.
 *
 * Before the registry, every controller allowed the role NAMES "owner" and
 * "admin", the seeded roles held module words ("orders") nothing read, and a
 * user given the seeded "manager" role was refused by every endpoint. These pin
 * the rules that replaced that: what a role resolves to, which screens it
 * opens, and which order steps kitchen and delivery staff may take.
 */
import { describe, expect, it } from "vitest";

import {
  ALL_PERMISSIONS,
  SYSTEM_ROLES,
  isOwnerRole,
  permissionProblems,
  withPrerequisites,
  withoutDependents,
} from "@/features/team/lib/permissions";
import { permissionsForRole } from "@/lib/server/auth/access";
import { canEditRoute, canOpenRoute, homeRoute, routePermissions } from "@/features/team/lib/route-access";
import {
  DELIVERY_ACTIVE_STATUSES,
  deliveryMoves,
  kitchenMoves,
  scopedMoveAllowed,
  scopedOrderVisible,
  statusScopeFor,
} from "@/features/orders/lib/staff-scope";
import { adminNavSections } from "@/constants/navigation";

const roles = new Map(SYSTEM_ROLES.map((r) => [r.slug, { permissions: [...r.permissions] as string[] }]));
const grantsOf = (slug: string) => permissionsForRole(slug, roles);
const holder = (slug: string) => {
  const held = grantsOf(slug);
  return (p: string) => held.has(p as never);
};

describe("what a role resolves to", () => {
  it("the owner holds every permission, whatever is stored for it", () => {
    const tampered = new Map([["owner", { permissions: ["orders.view"] }]]);
    expect(permissionsForRole("owner", tampered).size).toBe(ALL_PERMISSIONS.length);
  });

  it("the legacy 'admin' role reads as an owner, so no install loses access mid-upgrade", () => {
    expect(isOwnerRole("admin")).toBe(true);
    expect(permissionsForRole("admin", new Map()).size).toBe(ALL_PERMISSIONS.length);
  });

  it("a custom role gets only what it lists", () => {
    const custom = new Map([["packer", { permissions: ["orders.view", "orders.update_status"] }]]);
    expect([...permissionsForRole("packer", custom)].sort()).toEqual(["orders.update_status", "orders.view"]);
  });

  it("an unknown role, or an old-style module word, grants nothing — it fails closed", () => {
    expect(permissionsForRole("ghost", roles).size).toBe(0);
    const legacy = new Map([["manager", { permissions: ["orders", "settings", "dashboard"] }]]);
    expect(permissionsForRole("manager", legacy).size).toBe(0);
  });

  it("every default role is a valid permission set", () => {
    for (const role of SYSTEM_ROLES) {
      expect(permissionProblems(role.permissions), role.slug).toEqual([]);
    }
  });

  it("the defaults match the brief: manager no refunds/team/settings, kitchen and riders no money", () => {
    const manager = grantsOf("manager");
    for (const p of ["orders.refund", "payments.refund", "payments.manage", "team.view", "roles.manage", "settings.manage", "security.manage"]) {
      expect(manager.has(p as never), `manager must not have ${p}`).toBe(false);
    }
    expect(manager.has("payments.view")).toBe(true);
    for (const slug of ["kitchen-staff", "delivery-staff"]) {
      const g = grantsOf(slug);
      for (const p of ["orders.view", "payments.view", "reports.revenue.view", "dashboard.view", "customers.view", "settings.view", "orders.cancel", "orders.refund"]) {
        expect(g.has(p as never), `${slug} must not have ${p}`).toBe(false);
      }
    }
    const editor = grantsOf("content-editor");
    for (const p of ["orders.view", "payments.view", "customers.view", "inventory.view", "settings.manage"]) {
      expect(editor.has(p as never), `content editor must not have ${p}`).toBe(false);
    }
    expect(editor.has("homepage.manage")).toBe(true);
  });
});

describe("validating a permission list", () => {
  it("refuses an id the registry does not know, rather than dropping it", () => {
    expect(permissionProblems(["orders.view", "orders.nuke"])).toEqual([
      expect.objectContaining({ permission: "orders.nuke" }),
    ]);
  });

  it("refuses a permission without its prerequisite", () => {
    expect(permissionProblems(["products.delete"])).toEqual([
      expect.objectContaining({ permission: "products.delete" }),
    ]);
    expect(permissionProblems(["products.delete", "products.view"])).toEqual([]);
  });

  it("ticking adds what is needed; unticking removes what depended on it", () => {
    expect(withPrerequisites(["products.delete"])).toEqual(["products.view", "products.delete"]);
    expect(withoutDependents(["products.view", "products.delete", "orders.view"], "products.view")).toEqual([
      "orders.view",
    ]);
  });

  it("status updates are valid with ANY order scope, so kitchen-only is a legal role", () => {
    expect(permissionProblems(["orders.view_kitchen", "orders.update_status"])).toEqual([]);
    expect(permissionProblems(["orders.update_status"])).toHaveLength(1);
  });
});

describe("which screens a role opens", () => {
  it("kitchen staff open the kitchen and nothing about money or customers", () => {
    const can = holder("kitchen-staff");
    expect(canOpenRoute("/admin/kitchen", can)).toBe(true);
    for (const path of ["/admin/dashboard", "/admin/orders", "/admin/orders/abc", "/admin/commerce/payments", "/admin/customers", "/admin/reports", "/admin/settings"]) {
      expect(canOpenRoute(path, can), path).toBe(false);
    }
    expect(homeRoute(can)).toBe("/admin/kitchen");
  });

  it("riders open their deliveries only", () => {
    const can = holder("delivery-staff");
    expect(canOpenRoute("/admin/deliveries", can)).toBe(true);
    expect(canOpenRoute("/admin/kitchen", can)).toBe(false);
    expect(canOpenRoute("/admin/orders", can)).toBe(false);
    expect(homeRoute(can)).toBe("/admin/deliveries");
  });

  it("a content editor opens the website screens, not orders or settings", () => {
    const can = holder("content-editor");
    for (const path of ["/admin/builders/homepage", "/admin/pages", "/admin/pages/x/edit", "/admin/banners", "/admin/media", "/admin/testimonials", "/admin/faq"]) {
      expect(canOpenRoute(path, can), path).toBe(true);
    }
    for (const path of ["/admin/orders", "/admin/commerce/payments", "/admin/customers", "/admin/commerce/inventory", "/admin/settings/general"]) {
      expect(canOpenRoute(path, can), path).toBe(false);
    }
  });

  it("product screens follow the action: add needs create, edit needs update", () => {
    const viewOnly = (p: string) => p === "products.view";
    expect(canOpenRoute("/admin/products", viewOnly)).toBe(true);
    expect(canOpenRoute("/admin/products/add", viewOnly)).toBe(false);
    expect(canOpenRoute("/admin/products/p1/edit", viewOnly)).toBe(false);
  });

  it("a screen nobody listed is closed — a new page is not open by default", () => {
    expect(routePermissions("/admin/some-new-screen")).toBeNull();
    expect(canOpenRoute("/admin/some-new-screen", () => true)).toBe(false);
  });

  it("every sidebar item is in the table — or it would vanish for everyone", () => {
    for (const section of adminNavSections) {
      for (const item of section.items) {
        expect(routePermissions(item.href), item.href).not.toBeNull();
      }
    }
  });

  it("view without manage opens a settings screen read-only", () => {
    const viewer = (p: string) => p === "settings.view";
    expect(canOpenRoute("/admin/settings/general", viewer)).toBe(true);
    expect(canEditRoute("/admin/settings/general", viewer)).toBe(false);
    const manager = (p: string) => p === "settings.view" || p === "settings.manage";
    expect(canEditRoute("/admin/settings/general", manager)).toBe(true);
  });
});

describe("the steps kitchen staff and riders may take", () => {
  const kitchen = statusScopeFor(new Set(["orders.view_kitchen", "orders.update_status"]), "k1");
  const rider = statusScopeFor(new Set(["orders.view_assigned", "orders.update_status"]), "r1");

  it("the kitchen starts and finishes, and nothing else", () => {
    expect(kitchenMoves({ status: "confirmed" })).toEqual(["preparing", "ready"]);
    expect(scopedMoveAllowed(kitchen, { status: "preparing" }, "ready")).toBe(true);
    expect(scopedMoveAllowed(kitchen, { status: "ready" }, "out_for_delivery")).toBe(false);
    expect(scopedMoveAllowed(kitchen, { status: "confirmed" }, "delivered")).toBe(false);
    expect(scopedMoveAllowed(kitchen, { status: "pending" }, "preparing")).toBe(false);
  });

  it("a rider moves only orders assigned to THEM", () => {
    const mine = { status: "ready" as const, deliveryPartner: { userId: "r1" } };
    const theirs = { status: "ready" as const, deliveryPartner: { userId: "r2" } };
    const nobody = { status: "ready" as const };
    expect(scopedMoveAllowed(rider, mine, "out_for_delivery")).toBe(true);
    expect(scopedMoveAllowed(rider, theirs, "out_for_delivery")).toBe(false);
    expect(scopedMoveAllowed(rider, nobody, "out_for_delivery")).toBe(false);
    expect(deliveryMoves({ status: "out_for_delivery", deliveryPartner: { userId: "r1" } }, "r1")).toEqual(["delivered"]);
    expect(scopedMoveAllowed(rider, mine, "preparing")).toBe(false);
  });

  it("a rider sees an order assigned while it is still being made, but cannot move it until it is ready", () => {
    expect(DELIVERY_ACTIVE_STATUSES).toEqual(expect.arrayContaining(["confirmed", "preparing", "ready", "out_for_delivery"]));
    expect(deliveryMoves({ status: "confirmed", deliveryPartner: { userId: "r1" } }, "r1")).toEqual([]);
    expect(deliveryMoves({ status: "preparing", deliveryPartner: { userId: "r1" } }, "r1")).toEqual([]);
    expect(scopedMoveAllowed(rider, { status: "preparing", deliveryPartner: { userId: "r1" } }, "out_for_delivery")).toBe(false);
  });

  it("what each can see", () => {
    expect(scopedOrderVisible(kitchen, { status: "preparing" })).toBe(true);
    expect(scopedOrderVisible(kitchen, { status: "delivered" })).toBe(false);
    expect(scopedOrderVisible(rider, { status: "ready", deliveryPartner: { userId: "r1" } })).toBe(true);
    expect(scopedOrderVisible(rider, { status: "ready", deliveryPartner: { userId: "r2" } })).toBe(false);
  });
});
