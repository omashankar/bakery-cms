/**
 * Two places where two numbers described the same thing and disagreed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  addToWishlist,
  getWishlistCount,
  getWishlistSlugs,
  pruneWishlist,
} from "@/apps/website/lib/wishlist";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

beforeEach(() => {
  localStorage.clear();
});

describe("a wishlist holding cakes the shop no longer publishes", () => {
  it("forgets them, so the badge and the page agree", () => {
    // The page resolves slugs against the published catalogue and drops what it
    // cannot find; the header badge counts the RAW slugs. A customer with two
    // unpublished cakes saw "5" beside the heart and three cards below it.
    addToWishlist("still-sold");
    addToWishlist("unpublished");
    addToWishlist("deleted");
    expect(getWishlistCount()).toBe(3);

    const removed = pruneWishlist(["still-sold", "something-else"]);

    expect(removed).toBe(2);
    expect(getWishlistSlugs()).toEqual(["still-sold"]);
    expect(getWishlistCount()).toBe(1);
  });

  it("says how many it removed, rather than quietly shrinking the list", () => {
    addToWishlist("gone");

    expect(pruneWishlist([])).toBe(1);
  });

  it("leaves a healthy wishlist alone, and writes nothing", () => {
    addToWishlist("a");
    addToWishlist("b");

    expect(pruneWishlist(["a", "b", "c"])).toBe(0);
    expect(getWishlistSlugs()).toEqual(["a", "b"]);
  });

  it("is run by the one screen that holds the catalogue", () => {
    const page = read("apps/website/pages/wishlist-page.tsx");

    expect(page).toContain("pruneWishlist(");
    // From the catalogue this page was handed, not from a browser cache.
    expect(page).toContain("catalog.map((cake) => cake.slug)");
  });
});

describe("the order summary after the shop reprices", () => {
  const page = read("apps/website/checkout/pages/checkout-page.tsx");

  it("shows the shop's line prices beside the shop's total", () => {
    // The lines were priced from the browser's cart while the total underneath
    // came from the server, so after "Prices have changed" the summary did not
    // add up — the customer was asked to review a list whose numbers
    // contradicted the number they were being asked to pay.
    expect(page).toContain("items={serverItems ?? items}");
  });

  it("adopts the shop's lines wherever it adopts the shop's totals", () => {
    const adoptions = page.match(/setServerTotals\(quote\.totals\)/g) ?? [];
    const lines = page.match(/setServerItems\(quote\.items\)/g) ?? [];

    expect(adoptions.length).toBeGreaterThan(0);
    expect(lines.length, "a branch takes the server's total but not its lines").toBe(
      adoptions.length,
    );
  });

  it("drops them together when anything that changes the price changes", () => {
    // A stale server total with fresh cart lines is the same disagreement the
    // other way round.
    const effect = page.slice(page.indexOf("setServerTotals(null)"));

    expect(effect.slice(0, 120)).toContain("setServerItems(null)");
  });
});
