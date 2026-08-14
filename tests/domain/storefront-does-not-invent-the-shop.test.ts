/**
 * Three things the storefront resolved out of the shipped demo data and
 * presented as this bakery's own.
 *
 * The demo catalogue is not a fallback. It is what the software came with, and
 * a shop that has not set something up has NOT set it up — saying otherwise
 * puts a claim on the page that nobody at the bakery made.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { chosenList, hoursIdentity } from "@/apps/website/lib/shipped-placeholder";
import { businessHours as shippedHours } from "@/constants/landing-data";
import { getStorefrontBusinessHours } from "@/apps/website/lib/settings";
import { reorderFromOrder } from "@/apps/website/lib/reorder";
import type { PlacedOrder } from "@/features/orders/lib/orders";

describe("opening hours", () => {
  it("are not invented for a shop that has none", () => {
    // `businessHours?.length ? … : defaultHours` published "Monday – Saturday,
    // 9:00 AM – 9:00 PM" under a heading reading "Opening Hours". A customer
    // can act on that and arrive at a shut door.
    expect(chosenList(undefined, shippedHours, hoursIdentity)).toEqual([]);
    expect(chosenList([], shippedHours, hoursIdentity)).toEqual([]);
  });

  it("are not claimed when they are still exactly the ones that shipped", () => {
    // The settings singleton is CREATED with the demo contact block, so "is it
    // filled in?" can never fail. Identical means seeded, not chosen — the same
    // rule already applied to the address, phone and map beside them.
    expect(chosenList([...shippedHours], shippedHours, hoursIdentity)).toEqual([]);
  });

  it("are published the moment the shop changes one of them", () => {
    const edited = [...shippedHours.slice(1), { day: "Monday – Friday", hours: "7:00 AM – 8:00 PM" }];

    expect(chosenList(edited, shippedHours, hoursIdentity)).toEqual(edited);
  });

  it("are published when the shop keeps the same days but different times", () => {
    const retimed = shippedHours.map((row) => ({ ...row, hours: "8:00 AM – 10:00 PM" }));

    expect(chosenList(retimed, shippedHours, hoursIdentity)).toEqual(retimed);
  });

  it("are published when the shop trims the list to its own days", () => {
    const fewer = [shippedHours[0]!];

    expect(chosenList(fewer, shippedHours, hoursIdentity)).toEqual(fewer);
  });
});

describe("the client reader the header and footer use", () => {
  // The third site with the same fallback, and the only one that runs in the
  // customer's browser. Mutating it alone used to break nothing.
  beforeEach(() => {
    localStorage.clear();
  });

  function storeSettings(contact: Record<string, unknown>) {
    localStorage.setItem(
      "bakery-cms-settings",
      // `general.siteName` is required: `parseSettings` discards a cached blob
      // without it and falls back to the defaults — which would quietly make
      // every assertion below a test of the default settings.
      JSON.stringify({ general: { siteName: "Test Bakery" }, contact: { ...contact } }),
    );
  }

  it("does not invent hours for a shop that has none", () => {
    storeSettings({ businessHours: [] });

    expect(getStorefrontBusinessHours()).toEqual([]);
  });

  it("does not publish the shipped hours as the shop's own", () => {
    storeSettings({ businessHours: [...shippedHours] });

    expect(getStorefrontBusinessHours()).toEqual([]);
  });

  it("publishes the hours the shop really set", () => {
    const real = [{ day: "Tue – Sun", hours: "7:00 AM – 7:00 PM" }];
    storeSettings({ businessHours: real });

    expect(getStorefrontBusinessHours()).toEqual(real);
  });
});

describe("reordering a past order", () => {
  const order = {
    orderNumber: "BK-1",
    items: [
      { productSlug: "shop-made-cake", name: "Shop Made Cake", image: "", price: 900, quantity: 1 },
    ],
  } as unknown as PlacedOrder;

  it("is checked against the catalogue it is given, not a catalogue it finds", () => {
    // The old code called `getProductBySlug`, which merges the shipped demo
    // constants with `loadProducts()` — the ADMIN's localStorage cache, seeded
    // with those same demo cakes and never populated in a customer's browser.
    // So every reorder of a real order reported "items may be unavailable".
    const result = reorderFromOrder(order, [{ slug: "shop-made-cake", inStock: true }]);

    expect(result.added).toBe(1);
    expect(result.unavailable).toEqual([]);
  });

  it("still skips a cake the shop has stopped selling", () => {
    expect(reorderFromOrder(order, []).added).toBe(0);
    expect(reorderFromOrder(order, []).unavailable).toEqual(["Shop Made Cake"]);
  });

  it("still skips a cake that is out of stock", () => {
    const result = reorderFromOrder(order, [{ slug: "shop-made-cake", inStock: false }]);

    expect(result.added).toBe(0);
    expect(result.unavailable).toEqual(["Shop Made Cake"]);
  });
});
