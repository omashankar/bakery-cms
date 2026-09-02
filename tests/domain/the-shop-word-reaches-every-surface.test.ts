import { describe, expect, it } from "vitest";

import { getAdminBreadcrumbs } from "@/lib/admin-breadcrumbs";

/**
 * A shop renames what it sells, and the whole admin follows.
 *
 * The mechanism — `resolveLabels`, `useBusinessLabels`, `getLabels` — has worked
 * for the life of the project, and a sweep still found 190 surfaces ignoring it.
 * The sidebar read the shop's word while the breadcrumb one line above it read
 * "Cakes", because `getAdminBreadcrumbs` took only a pathname and its labels
 * lived in a module-level constant it could not reach.
 *
 * These use a fixture whose words appear NOWHERE in the codebase, so a case can
 * only pass by actually threading the labels through. Asserting the absence of
 * "Cake" as well as the presence of the fixture catches the half-fix where a
 * shop word is added beside the welded-in one rather than replacing it.
 */
const SHOP = { productWord: "Zzyzx", productWordPlural: "Zzyzxes" };

/** Every label in the trail, joined, for the "no bakery noun survived" checks. */
function trail(pathname: string) {
  return getAdminBreadcrumbs(pathname, SHOP)
    .map((crumb) => crumb.label)
    .join(" > ");
}

describe("the admin breadcrumb", () => {
  it("names the catalog with the shop's own plural", () => {
    expect(trail("/admin/cakes")).toBe("Dashboard > Zzyzxes");
  });

  it("says Add and Edit in the shop's own singular", () => {
    expect(trail("/admin/cakes/add")).toBe("Dashboard > Zzyzxes > Add Zzyzx");
    expect(trail("/admin/cakes/abc123/edit")).toBe("Dashboard > Zzyzxes > Edit Zzyzx");
  });

  it("names a single record with the shop's own singular", () => {
    // The fallback branch, reached by a product id that is not add/edit/preview.
    expect(trail("/admin/cakes/abc123")).toBe("Dashboard > Zzyzxes > Zzyzx Details");
  });

  it("leaves no bakery noun anywhere in a product trail", () => {
    for (const path of [
      "/admin/cakes",
      "/admin/cakes/add",
      "/admin/cakes/abc123",
      "/admin/cakes/abc123/edit",
      "/admin/cakes/abc123/preview",
    ]) {
      expect(trail(path), path).not.toMatch(/cake/i);
    }
  });

  /**
   * The other half of the map is NOT the shop's business.
   *
   * "Dashboard", "Settings", "SMTP" name features of the admin, not goods. A fix
   * that made the whole record configurable would let a shop rename its own
   * Settings screen, and the next person would have to guess which entries were
   * meant to move.
   */
  it("does not touch segments that name the admin rather than the goods", () => {
    expect(trail("/admin/settings/smtp")).toBe("Dashboard > Settings > SMTP");
    expect(trail("/admin/orders")).toBe("Dashboard > Orders");
  });

  it("still calls a page a Page and an order an Order", () => {
    // These share the `add`/`edit`/dynamic branches with products and are
    // handled ahead of them. Relabelling by accident is the likely regression.
    expect(trail("/admin/pages/add")).toBe("Dashboard > Pages > Add Page");
    expect(trail("/admin/pages/abc123/edit")).toBe("Dashboard > Pages > Edit Page");
    expect(trail("/admin/orders/abc123")).toBe("Dashboard > Orders > Order Details");
    expect(trail("/admin/customers/abc123")).toBe("Dashboard > Customers > Customer Details");
  });
});
