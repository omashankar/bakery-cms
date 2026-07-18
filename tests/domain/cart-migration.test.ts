/**
 * The cakeSlug -> productSlug rename touches PERSISTED data: an in-progress
 * cart and every past order in localStorage. These tests prove existing data
 * survives the rename instead of silently losing its product reference.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { getCartItems, migrateLegacyCartItem } from "@/features/cart/lib/cart";
import { getOrders } from "@/features/orders/lib/orders";

beforeEach(() => {
  localStorage.clear();
});

describe("migrateLegacyCartItem", () => {
  it("renames cakeSlug to productSlug", () => {
    const legacy = { id: "l1", cakeSlug: "black-forest", name: "Black Forest", price: 500 };

    const migrated = migrateLegacyCartItem(legacy);

    expect(migrated.productSlug).toBe("black-forest");
    expect("cakeSlug" in migrated).toBe(false);
  });

  it("preserves every other field", () => {
    const legacy = {
      id: "l1",
      cakeSlug: "red-velvet",
      name: "Red Velvet",
      image: "/a.jpg",
      price: 700,
      quantity: 2,
      weight: "1 kg",
      message: "Happy Birthday",
    };

    const migrated = migrateLegacyCartItem(legacy);

    expect(migrated).toMatchObject({
      id: "l1",
      name: "Red Velvet",
      image: "/a.jpg",
      price: 700,
      quantity: 2,
      weight: "1 kg",
      message: "Happy Birthday",
    });
  });

  it("leaves already-migrated items untouched", () => {
    const current = { id: "l1", productSlug: "black-forest", price: 500 };

    expect(migrateLegacyCartItem(current)).toEqual(current);
  });

  it("is idempotent", () => {
    const legacy = { id: "l1", cakeSlug: "black-forest", price: 500 };
    const once = migrateLegacyCartItem(legacy);

    expect(migrateLegacyCartItem(once)).toEqual(once);
  });

  it("does not invent a productSlug when neither key is present", () => {
    const odd = { id: "l1", price: 500 };

    expect(migrateLegacyCartItem(odd)).toEqual(odd);
  });
});

describe("a cart saved before the rename still loads", () => {
  it("upgrades legacy line items on read", () => {
    localStorage.setItem(
      "bakery-cms-cart",
      JSON.stringify([
        { id: "l1", cakeSlug: "black-forest", name: "Black Forest", image: "", price: 500, quantity: 1 },
        { id: "l2", cakeSlug: "red-velvet", name: "Red Velvet", image: "", price: 700, quantity: 2 },
      ])
    );

    const items = getCartItems();

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.productSlug)).toEqual(["black-forest", "red-velvet"]);
    expect(items[1].quantity).toBe(2);
  });
});

describe("order history saved before the rename still loads", () => {
  it("upgrades line items inside stored orders", () => {
    localStorage.setItem(
      "bakery-cms-orders",
      JSON.stringify([
        {
          id: "o1",
          orderNumber: "BK-1001",
          placedAt: "2026-01-01T00:00:00.000Z",
          status: "confirmed",
          paymentMethod: "cod",
          statusHistory: [],
          items: [
            { id: "l1", cakeSlug: "black-forest", name: "Black Forest", image: "", price: 500, quantity: 1 },
          ],
        },
      ])
    );

    const orders = getOrders();

    expect(orders).toHaveLength(1);
    expect(orders[0].items[0].productSlug).toBe("black-forest");
    expect("cakeSlug" in orders[0].items[0]).toBe(false);
  });
});
