/**
 * An order's items are not the cart's items, and that is where the ids went.
 *
 * `QuoteLineInput` — what the storefront sends to be priced — deliberately
 * carries only the slug, quantity and personalisation, because the PRICE is the
 * shop's to decide and a browser must not get a say in it. The priced line the
 * server built from that inherited the same fields plus name, image and price,
 * and no `id`. So every order placed through checkout was stored with items
 * that could not be told apart, and the three screens that render an order —
 * the admin order detail, the printed invoice, and the customer's own order
 * list — all keyed their rows on `undefined`.
 *
 * React said so. The quieter half is that two lines of the same cake in
 * different sizes share a key, and React is then free to reuse one row's DOM
 * for the other: on an INVOICE, which is the document the shop and the customer
 * both rely on.
 *
 * Three real orders in this shop's database are in that state, which is why the
 * repair runs on read rather than as a one-off script — tightening a type never
 * touches data at rest.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { cartLineId, withStableLineIds } from "@/features/cart/lib/cart";

/**
 * The shape the server actually stored: no id, no image.
 *
 * Typed loosely on purpose — these are the fields a stored order line HAS, not
 * the ones `CartLineItem` says it should, and pretending otherwise is what let
 * the missing `id` go unnoticed in the first place.
 */
interface StoredLine {
  productSlug: string;
  name: string;
  price: number;
  quantity: number;
  weight?: string;
  flavour?: string;
  shape?: string;
  variantSelections?: Record<string, string>;
  id?: string;
}

const AS_STORED: StoredLine[] = [
  {
    productSlug: "chocolate-truffle-delight",
    name: "Chocolate Truffle Delight",
    price: 1299,
    quantity: 1,
    weight: "0.5 kg",
    flavour: "Chocolate",
    shape: "Round",
    variantSelections: { "group-9d9a93f5": "opt-88d94960" },
  },
  {
    productSlug: "choco-chip-brownie-cake",
    name: "Choco Chip Brownie Cake",
    price: 799,
    quantity: 1,
  },
];

describe("an order line with no id", () => {
  it("is given one, so a list can key on it", () => {
    const repaired = withStableLineIds(AS_STORED);

    for (const [index, item] of repaired.entries()) {
      expect(item.id, `line ${index} still has no id`).toBeTruthy();
    }
    expect(new Set(repaired.map((item) => item.id)).size, "two lines share a key").toBe(
      repaired.length,
    );
  });

  it("gets the SAME id the cart would have given it", () => {
    // So a line means one thing on both sides of checkout. Deriving a different
    // id here would be a second identity for the same object, which is the
    // shape of bug this repo keeps producing.
    const [first] = withStableLineIds(AS_STORED);
    expect(first.id).toBe(cartLineId(AS_STORED[0]));
  });

  it("keeps the id a line already has", () => {
    const kept = withStableLineIds([{ ...AS_STORED[0], id: "line-from-the-cart" }]);
    expect(kept[0].id, "an existing identity was overwritten").toBe("line-from-the-cart");
  });

  it("is unchanged by running twice", () => {
    // It runs on every read, on both sides. A repair that drifts each time
    // would make React remount every row of every order list.
    const once = withStableLineIds(AS_STORED);
    const twice = withStableLineIds(once);
    expect(twice).toEqual(once);
  });

  it("does not collide with a line that already holds the id it would pick", () => {
    /**
     * Half-repaired orders exist: some lines carry the cart's id, some do not.
     * If a bare line hashes to an id its neighbour already holds, assigning it
     * anyway puts the duplicate key back — while looking fixed.
     */
    const taken = cartLineId(AS_STORED[0]);
    const repaired = withStableLineIds([
      { ...AS_STORED[1], id: taken },
      { ...AS_STORED[0] },
    ]);

    expect(repaired[0].id).toBe(taken);
    expect(repaired[1].id, "the repair handed out an id already in use").not.toBe(taken);
    expect(repaired[1].id).toBeTruthy();
  });

  it("keeps two identical personalisations apart", () => {
    // The cart merges these, so they only arrive separately — and an order is
    // whatever arrived. Losing a line from an invoice is worse than an id
    // nobody reads, so they are suffixed rather than dropped.
    const twice = withStableLineIds([{ ...AS_STORED[1] }, { ...AS_STORED[1] }]);

    expect(twice).toHaveLength(2);
    expect(twice[0].id).not.toBe(twice[1].id);
  });
});

describe("both paths an order reaches a screen by", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("repairs it on the server read", () => {
    /**
     * `toOrder` is the one place every server read passes through — detail,
     * invoice, list, the customer's account. Repairing anywhere else would mean
     * repairing in several places, and the screens that render an order do not
     * share a component.
     */
    const repository = read("features/orders/server/order.repository.ts");
    const from = repository.indexOf("function toOrder");
    expect(from, "the server order mapper is gone").toBeGreaterThan(-1);

    const mapper = repository.slice(from, repository.indexOf("\n}", from));
    expect(mapper, "server reads hand out items with no identity").toContain(
      "withStableLineIds(order.items)",
    );
  });

  it("repairs it in the browser's cache too", () => {
    // The screens read whichever copy answers first, and this one holds orders
    // fetched before the priced line carried an id.
    const orders = read("features/orders/lib/orders.ts");
    const from = orders.indexOf("function normalizeOrder");
    expect(from, "the client order normaliser is gone").toBeGreaterThan(-1);

    const normalize = orders.slice(from, orders.indexOf("\n}", from));
    expect(normalize, "the cached copy still has items with no identity").toContain(
      "withStableLineIds(",
    );
  });

  it("gives a newly priced line an id at the source", () => {
    // The repair above is for what is already stored. Everything placed from
    // now on should not need it.
    const pricing = read("features/checkout/server/pricing.server.ts");
    const from = pricing.indexOf("items.push({");
    expect(from, "the priced line is no longer built here").toBeGreaterThan(-1);

    expect(
      pricing.slice(from, pricing.indexOf("});", from)),
      "a freshly priced line is still born without an identity",
    ).toContain("id: cartLineId(line)");
  });
});
