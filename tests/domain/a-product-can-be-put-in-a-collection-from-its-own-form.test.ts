import { describe, expect, it } from "vitest";

import { collectionsWithProduct } from "@/features/catalog/lib/catalog-repository";
import type { ProductCollection } from "@/types/product";

/**
 * BOTH ENDS EDIT ONE LIST.
 *
 * A collection could only be filled from inside itself — right for building a
 * Diwali row out of forty products, wrong for the one moment a shop actually
 * thinks about it, which is naming a new product and saying where it belongs.
 * The product form now ticks collections too.
 *
 * What it does NOT do is copy the membership onto the product. There is no
 * `collectionIds` field on a product and this is why: two copies of one fact
 * drift, and the cost of keeping them in step is paid on every screen that
 * writes either. Both ends edit `collection.productIds`, and this is the
 * function that decides what that array becomes.
 */

const collection = (
  id: string,
  productIds: string[],
): ProductCollection => ({
  id,
  name: id,
  slug: id,
  productIds,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("ticking a collection on a product form", () => {
  it("adds the product to the END of that collection", () => {
    /*
      THE ORDER IS THE CURATION. A shop puts its best seller first, and no
      property of the products can recover that afterwards — so a product
      ticked on its own form joins the back of the queue rather than
      displacing whatever the shop chose to lead with.
    */
    const { next } = collectionsWithProduct(
      [collection("best", ["lead", "second"])],
      "newcomer",
      ["best"],
    );

    expect(next[0]?.productIds).toEqual(["lead", "second", "newcomer"]);
  });

  it("takes it out again when the tick is cleared", () => {
    const { next } = collectionsWithProduct(
      [collection("best", ["lead", "target", "second"])],
      "target",
      [],
    );

    expect(next[0]?.productIds).toEqual(["lead", "second"]);
  });

  it("leaves the collections it did not change exactly as they were", () => {
    /*
      IDENTITY, not just equality. Each catalog section is a replace-all write,
      so a collection rebuilt for no reason is a curated order rewritten by a
      product save that had nothing to do with it.
    */
    const untouched = collection("other", ["a", "b"]);
    const { next, changed } = collectionsWithProduct(
      [collection("best", []), untouched],
      "p1",
      ["best"],
    );

    expect(changed).toBe(1);
    expect(next[1]).toBe(untouched);
  });

  it("and says nothing changed when nothing did", () => {
    /*
      The caller skips the write entirely on zero, so this is what keeps a
      product save that touched no collection from publishing the whole
      section back over whatever another admin was editing.
    */
    const rows = [collection("best", ["p1"]), collection("other", [])];

    expect(collectionsWithProduct(rows, "p1", ["best"]).changed).toBe(0);
  });

  it("adds and removes in one pass", () => {
    const { next, changed } = collectionsWithProduct(
      [collection("in", ["p1"]), collection("out", [])],
      "p1",
      ["out"],
    );

    expect(changed).toBe(2);
    expect(next[0]?.productIds).toEqual([]);
    expect(next[1]?.productIds).toEqual(["p1"]);
  });

  it("treats a collection that has never been filled as empty rather than throwing", () => {
    /*
      `productIds` is required by the type, but these rows are stored as Mixed
      and read with `.lean()` — a group created before the field was declared
      comes back without it.
    */
    const bare = { ...collection("fresh", []) } as ProductCollection;
    delete (bare as { productIds?: string[] }).productIds;

    const { next } = collectionsWithProduct([bare], "p1", ["fresh"]);

    expect(next[0]?.productIds).toEqual(["p1"]);
  });

  it("does not add the same product twice", () => {
    const { next, changed } = collectionsWithProduct(
      [collection("best", ["p1"])],
      "p1",
      ["best"],
    );

    expect(changed).toBe(0);
    expect(next[0]?.productIds).toEqual(["p1"]);
  });
});
