/**
 * A ROLE CAN BE SET WITH ONE CHOICE PER AREA — and each choice grants exactly
 * what it says, and nothing in any other area.
 *
 * The simple role editor (No access / View / Full, plus Kitchen only and Own
 * deliveries for orders) writes the same permission ids the server checks.
 * A wrong mapping would hand out — or silently take away — real access.
 */
import { describe, expect, it } from "vitest";

import { accessLevels, applyLevel, currentLevel } from "@/features/team/lib/access-levels";
import { PERMISSION_MODULES, SYSTEM_ROLES, permissionProblems, type Permission } from "@/features/team/lib/permissions";

const level = (module: Parameters<typeof accessLevels>[0], id: string) =>
  accessLevels(module).find((l) => l.id === id)!;

describe("each choice", () => {
  it("Kitchen only is exactly the kitchen queue and status updates — no prices", () => {
    expect(applyLevel([], "orders", level("orders", "kitchen"))).toEqual(["orders.view_kitchen", "orders.update_status"]);
  });

  it("Own deliveries is exactly own deliveries and status updates", () => {
    expect(applyLevel([], "orders", level("orders", "deliveries"))).toEqual(["orders.view_assigned", "orders.update_status"]);
  });

  it("View never includes a write", () => {
    for (const module of PERMISSION_MODULES) {
      const view = level(module.id, "view").permissions;
      expect(view.length, module.id).toBeGreaterThan(0);
      expect(view.every((p) => /\.view/.test(p) || p === "dashboard.view"), module.id).toBe(true);
    }
  });

  it("every choice is a valid permission set on its own", () => {
    for (const module of PERMISSION_MODULES) {
      for (const l of accessLevels(module.id)) {
        expect(permissionProblems(applyLevel([], module.id, l)), `${module.id}/${l.id}`).toEqual([]);
      }
    }
  });

  it("changing one area leaves every other area alone", () => {
    const start: Permission[] = ["products.view", "products.update", "coupons.view"];
    const next = applyLevel(start, "orders", level("orders", "full"));
    expect(next).toEqual(expect.arrayContaining(start));
    expect(applyLevel(next, "orders", level("orders", "none"))).toEqual(
      expect.arrayContaining(["products.view", "products.update", "coupons.view"]),
    );
    expect(applyLevel(next, "orders", level("orders", "none")).some((p) => p.startsWith("orders."))).toBe(false);
  });

  it("never hands out a permission the editor does not hold", () => {
    const next = applyLevel([], "payments", level("payments", "full"), ["payments.refund"]);
    expect(next).not.toContain("payments.refund");
    expect(next).toContain("payments.view");
  });
});

describe("reading a role back", () => {
  it("the default roles read as the choices they were built from", () => {
    const kitchen = SYSTEM_ROLES.find((r) => r.slug === "kitchen-staff")!.permissions;
    expect(currentLevel("orders", kitchen)?.id).toBe("kitchen");
    expect(currentLevel("payments", kitchen)?.id).toBe("none");
    const rider = SYSTEM_ROLES.find((r) => r.slug === "delivery-staff")!.permissions;
    expect(currentLevel("orders", rider)?.id).toBe("deliveries");
  });

  it("a hand-made mix reads as custom rather than being rounded to a level", () => {
    expect(currentLevel("orders", ["orders.view", "orders.refund"])).toBeNull();
  });
});
