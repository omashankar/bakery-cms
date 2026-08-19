/**
 * Opening ANY admin page read every order in the shop, to fetch a field kept in
 * its own collection.
 *
 * The admin layout hydrates the admin's own notes on customers — tags, notes,
 * marketing consent — on entering the admin. It did that by calling
 * `/api/customers` and keeping only `c.meta` off each row.
 *
 * That endpoint DERIVES its answer. A customer is not stored anywhere; they
 * exist only as the sum of their orders, so building the list reads the whole
 * orders collection, maps every document, builds every profile and serialises
 * the lot. All of it was then thrown away except the notes — which live in
 * `customermetas`, one small document per annotated customer.
 *
 * Because it runs from the LAYOUT, that was the price of opening the dashboard,
 * the media library, the SEO screen — anything. At eight orders it is
 * invisible; at ten thousand it is tens of megabytes per page load, and the
 * cost arrives gradually, which is how it stays unnoticed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

/** The named export's body, to the next top-level `export`. */
function exportedFunction(code: string, name: string): string {
  const at = code.indexOf(name);
  expect(at, `${name} is gone`).toBeGreaterThan(-1);
  const rest = code.slice(at);
  const next = rest.slice(1).search(/\nexport /);
  return next > 0 ? rest.slice(0, next + 1) : rest;
}

describe("the hydration the admin layout runs on every entry", () => {
  const api = () => stripComments(read("apps/admin/commerce/lib/customers-api.ts"));

  it("asks for the notes, not for every customer profile", () => {
    const fetcher = exportedFunction(api(), "export async function fetchCustomerMetaMap");

    expect(fetcher, "the layout still derives every profile to read one field").not.toMatch(
      /["']\/api\/customers["']/,
    );
    expect(fetcher, "the notes endpoint is not being used").toContain("/api/customers/meta");
  });

  it("is still what the layout calls", () => {
    /**
     * The saving only exists if this is the fetcher on the layout's path. A
     * cheaper endpoint nobody calls is not a fix.
     */
    const hook = stripComments(read("apps/admin/commerce/lib/use-customers-server-sync.ts"));
    expect(hook).toContain("fetchCustomerMetaMap");

    const layout = stripComments(read("layouts/admin-layout.tsx"));
    expect(layout, "the admin layout no longer hydrates customer notes at all").toContain(
      "useCustomersServerSync()",
    );
  });

  it("leaves the full profile fetch alone", () => {
    /**
     * `fetchCustomerProfiles` SHOULD read every order — that is the Customers
     * screen, where the derived totals are the point, and capping it would drop
     * older customers entirely rather than shorten the list.
     *
     * Asserted so a later "optimisation" does not point that one at the notes
     * endpoint and quietly empty the screen.
     */
    const profiles = exportedFunction(api(), "export async function fetchCustomerProfiles");

    expect(profiles, "the Customers screen was pointed at the notes endpoint").not.toContain(
      "/api/customers/meta",
    );
    expect(profiles).toMatch(/["']\/api\/customers["']/);
  });
});

describe("the endpoint behind it", () => {
  it("reads one collection and no orders", () => {
    const service = stripComments(read("features/customers/server/customers.service.ts"));
    const fn = exportedFunction(service, "export async function getCustomerMeta");

    expect(fn, "the notes endpoint derives profiles from orders too").not.toContain("orderRepo");
    expect(fn, "the notes endpoint does not read the notes").toContain("listMeta(");
  });

  it("is wired up and admin-only", () => {
    const route = stripComments(read("app/api/customers/meta/route.ts"));
    expect(route, "the notes endpoint is not reachable").toContain("GET");

    const controller = stripComments(read("features/customers/server/customers.controller.ts"));
    const fn = exportedFunction(controller, "export const listCustomerMetaController");

    // Customer notes are the admin's private annotations — who is a repeat
    // buyer, who complained — and this endpoint lists all of them.
    expect(fn, "anyone can read the shop's private notes on its customers").toContain(
      "requireRole(",
    );
  });

  it("still derives the full list for the screen that needs it", () => {
    // The expensive one is correct where it is used, and this says so, so that
    // "nothing calls listSince(null) any more" is never mistaken for the goal.
    const service = stripComments(read("features/customers/server/customers.service.ts"));
    const fn = exportedFunction(service, "export async function getCustomers");

    expect(fn, "the Customers screen stopped seeing older customers").toContain(
      "orderRepo.listSince(null)",
    );
  });
});
