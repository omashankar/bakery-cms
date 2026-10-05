/**
 * WHAT A SHOP IS OFFERED, AND IN WHOSE WORDS.
 *
 * Two things the Add-section dialog got wrong, both measured in the browser
 * before they were fixed and both about the same list of 29 rows.
 *
 * IT OFFERED TWO BAKERY SECTIONS TO EVERY SHOP. `photo-cakes` and `eggless`
 * are bakery slugs frozen into the section type — the renderer dispatches them
 * by those names — and they are kept because layouts already published carry
 * them. This shop's homepage has one. The reason for keeping them covers
 * RENDERING; it never covered offering them, so a florist opening the picker
 * read "Photo Cakes" and "Eggless Cakes" among the things it could build its
 * page from. `category-rail` is what a shop adds instead, and it picks the
 * category from the shop's own list.
 *
 * AND IT SHOUTED IN LOWER CASE. The token pair is `{Products}` and
 * `{products}`; the lower one calls `.toLowerCase()` outright, so the upper
 * one was always the capitalised half — except it returned the word as typed.
 * This shop's plural is "products", so the picker read "products by category",
 * "Featured products" and "Trending products" in a list whose every other row
 * is Title Case.
 */
import { describe, expect, it } from "vitest";

import {
  ADDABLE_SECTION_REGISTRY,
  HOMEPAGE_SECTION_REGISTRY,
  getRegistryEntry,
  resolveRegistryEntry,
} from "@/constants/section-registry";

/*
  THE LIST THE BUILDER ITSELF HANDS THE DIALOG, imported rather than rebuilt.

  The first version of this file wrote `HOMEPAGE_SECTION_REGISTRY.filter((e) =>
  !e.legacy)` here — its own copy of the builder’s rule — and a mutation proved
  what that is worth: taking the filter OUT of the builder left every case
  green, because the test was checking its own arithmetic.
*/
const offered = ADDABLE_SECTION_REGISTRY;

/**
 * EVERY SECTION THE PICKER DOES NOT OFFER, written out.
 *
 * Nine more were here and are now DELETED outright — registry entry, renderer
 * and component — so they cannot be hidden, only absent. These two remain
 * hidden rather than deleted: they are slugs frozen into the section type and
 * published layouts carry them.
 *
 * Spelled out rather than derived from the flag, so that marking one more
 * entry `notOffered` fails here until somebody adds it to this list — which
 * is the point. Hiding a row from a shop should be a decision, not a diff.
 */
const DROPPED = ["eggless", "photo-cakes"] as const;

const WORDS = { productWord: "product", productWordPlural: "products" };

describe("the list a shop is offered", () => {
  it("leaves out every section marked not-offered", () => {
    const names = offered.map((entry) => entry.type);
    for (const type of DROPPED) {
      expect(names, `"${type}" is still offered in Add section`).not.toContain(type);
    }
  });

  it("but the registry still HAS them, or a published page loses its editor", () => {
    /*
      THE HALF THAT MAKES THE OTHER HALF SAFE, and the live document says why.

      This shop's homepage carries a `photo-cakes` section. None of the other
      ten is on the page — checked, draft and published both — but ALL of them
      are in its twenty saved REVISIONS, and the builder can restore one. The
      builder resolves an existing section's fields through
      `getRegistryEntry`, which searches the whole registry, so a restored
      revision keeps its editor. Filter there instead and it renders with
      nothing behind it.

      AND EACH CARRIES ITS REASON. A bare flag would not have survived the
      second use: two of these are frozen bakery slugs kept for published
      layouts, the rest are sections the shop turned down, and only one of
      those two groups would ever come back.
    */
    for (const type of DROPPED) {
      const entry = getRegistryEntry(type as never);
      expect(entry, `${type} is gone from the registry, not just from the picker`).toBeTruthy();
      expect(
        (entry!.notOffered ?? "").trim(),
        `${type} is hidden with no reason written down`,
      ).not.toBe("");
    }
  });

  it("and offers everything else", () => {
    /*
      A COUNT, so that hiding a row by accident is as loud as offering one.
      Measured in the browser: 29 rows, then 27 once two were hidden, now 18 —
      the same 18, because the nine hidden in between are deleted outright.
    */
    expect(HOMEPAGE_SECTION_REGISTRY).toHaveLength(20);
    expect(offered).toHaveLength(20 - DROPPED.length);
    expect(
      HOMEPAGE_SECTION_REGISTRY.filter((entry) => entry.notOffered)
        .map((entry) => entry.type)
        .sort(),
      "something was hidden from the picker without being listed here",
    ).toEqual([...DROPPED].sort());
  });
});

describe("the words those rows are named in", () => {
  const labelFor = (type: string) =>
    resolveRegistryEntry(getRegistryEntry(type as never)!, WORDS).label;

  it("capitalises the shop's word where the label asks for a capital", () => {
    /*
      THE THREE THE PICKER ACTUALLY DREW WRONG, by their templates:
        "{Products} by category"  -> "products by category"
        "Featured {Products}"     -> "Featured products"
        "Trending {Products}"     -> "Trending products"
    */
    expect(labelFor("category-rail")).toBe("Products by category");
    expect(labelFor("featured-cakes")).toBe("Featured Products");
    expect(labelFor("trending")).toBe("Trending Products");
  });

  it("including the SINGULAR token, which no label happens to use", () => {
    /*
      NO REGISTRY LABEL USES `{Product}` TODAY, so the three cases above
      leave it untested — a mutation proved it: dropping the capital from the
      singular token alone changed nothing any of them could see. It is the
      half of a matched pair, and the next label to need it would arrive
      broken.
    */
    const fill = (template: string) =>
      resolveRegistryEntry(
        { ...getRegistryEntry("hero")!, label: template },
        WORDS,
      ).label;
    expect(fill("Add {Product}")).toBe("Add Product");
    expect(fill("{Product} page")).toBe("Product page");
    expect(fill("Search {product}")).toBe("Search product");
  });

  it("and still lower-cases where the label asks for lower case", () => {
    /*
      `{products}` is a separate token and is used mid-sentence. Capitalising
      BOTH would have been the same bug pointing the other way.
    */
    expect(labelFor("tabbed-rail")).toBe("Tabbed products");
  });

  it("but never re-cases a word the shop cased itself", () => {
    /*
      A SHOP SELLING iPhones TYPES "iPhones", and upper-casing the first
      letter unconditionally gives "IPhones" — a worse answer than the one
      being fixed. A word carrying a capital anywhere is one the shop meant.
    */
    const cased = { productWord: "iPhone", productWordPlural: "iPhones" };
    expect(
      resolveRegistryEntry(getRegistryEntry("category-rail")!, cased).label,
    ).toBe("iPhones by category");

    /* And a word already capitalised is left exactly as it is. */
    const title = { productWord: "Bouquet", productWordPlural: "Bouquets" };
    expect(
      resolveRegistryEntry(getRegistryEntry("category-rail")!, title).label,
    ).toBe("Bouquets by category");
  });

  it("and no row a shop is offered starts in lower case", () => {
    /*
      THE SWEEP, because the three above are the ones that were wrong today
      and a fourth template could be added tomorrow. Measured in the browser
      after the fix: no offered row starts with a lower-case letter.
    */
    const shouting = offered
      .map((entry) => resolveRegistryEntry(entry, WORDS).label)
      .filter((label) => /^[a-z]/.test(label));
    expect(shouting, "a row in a Title Case list starts in lower case").toEqual([]);
  });
});
