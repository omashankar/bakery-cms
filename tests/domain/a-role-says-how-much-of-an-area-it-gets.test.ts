/**
 * A ROLE SAYS HOW MUCH OF AN AREA IT GETS — AND A MANAGER SEES THE KITCHEN.
 *
 * The roles table listed "Orders" for Kitchen Staff, Delivery Staff and the
 * Manager alike, who see very different things. And the Manager — who sees
 * every order and moves them — could not open the kitchen board at all.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SYSTEM_ROLES, type Permission } from "@/features/team/lib/permissions";
import { currentLevel } from "@/features/team/lib/access-levels";
import { canOpenRoute } from "@/features/team/lib/route-access";

const role = (slug: string) => SYSTEM_ROLES.find((r) => r.slug === slug)!;
const can = (slug: string) => (p: Permission) => role(slug).permissions.includes(p);

describe("the kitchen board", () => {
  it.each([
    ["kitchen-staff", true],
    ["manager", true],
    ["delivery-staff", false],
    ["content-editor", false],
  ])("%s may open it: %s", (slug, expected) => {
    expect(canOpenRoute("/admin/kitchen", can(slug))).toBe(expected);
  });

  it("its data answers the same people", () => {
    const controller = readFileSync(join(process.cwd(), "features/orders/server/order.controller.ts"), "utf8");
    const fn = controller.slice(controller.indexOf("export const kitchenQueueController"));
    expect(fn.slice(0, 300)).toContain('requireAnyPermission("orders.view_kitchen", "orders.view")');
  });
});

describe("the orders level each default role has", () => {
  it.each([
    ["kitchen-staff", "kitchen"],
    ["delivery-staff", "deliveries"],
  ])("%s reads as %s, not just 'Orders'", (slug, level) => {
    expect(currentLevel("orders", role(slug).permissions)?.id).toBe(level);
  });

  it("the roles table prints the level beside the area", () => {
    const tab = readFileSync(join(process.cwd(), "apps/admin/team/components/roles-tab.tsx"), "utf8");
    expect(tab).toContain("withLevel(m.label, currentLevel(m.id, role.permissions)?.id)");
    expect(tab).toContain("kitchen only");
    expect(tab).toContain("own deliveries");
  });
});
