import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";

/**
 * THE ROW OF CATEGORY CARDS WITH A PRICE ON EACH.
 *
 * Every other number on this homepage is typed by the shop. This one must not
 * be. The card says what the cheapest thing in a category costs, and the page
 * it links to lists that category — so a stored figure is a promise the CMS
 * cannot keep: the shop edits one product and the card goes on advertising
 * last month's price to a customer who then lands on a page that disagrees
 * with the card that sent them.
 *
 * So the load-bearing facts here are what is ABSENT (any field an admin could
 * type a price into) and where the number comes from instead.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** The section's own function body, so an assertion cannot match a sibling's. */
function body(): string {
  const src = codeOf(read(RENDERER));
  const at = src.indexOf("function CategoryPriceCardsSection(");
  expect(at, "CategoryPriceCardsSection is gone").toBeGreaterThan(-1);
  const rest = src.slice(at + 10);
  const next = rest.search(/\n(?:export )?function /);
  return next < 0 ? src.slice(at) : src.slice(at, at + 10 + next);
}

describe("the row that reads its own prices", () => {
  const entry = HOMEPAGE_SECTION_REGISTRY.find((s) => s.type === "category-price-cards");

  it("is in the registry, and ships with no cards", () => {
    expect(entry, "the price-card row is gone from the registry").toBeTruthy();
    expect(entry!.defaultContent.items).toBe("[]");
    // No heading is invented for a shop that has not written one.
    expect(entry!.defaultContent.title).toBe("");
    /*
      The line under the heading is not blank, it is GONE: the shop asked
      for the Description box off every section, so there is no key left to
      ship empty. Asserted as absent rather than deleted, because a default
      reappearing here is a sentence this CMS would be putting in the shop's
      mouth.
    */
    expect(entry!.defaultContent.description).toBeUndefined();
  });

  it("offers nobody a box to type a price into", () => {
    /*
      The trap this is written for: somebody adds `price` or `startingFrom` to
      the card's fields because it is the obvious thing to do, and from then
      on the row advertises whatever was typed rather than what is for sale.
    */
    const columns = entry!.fields.find((f) => f.key === "items")?.itemFields ?? [];

    expect(columns.map((c) => c.key).sort()).toEqual([
      "categorySlug",
      "image",
      "label",
      "tone",
    ]);

    const everyKey = [
      ...entry!.fields.map((f) => f.key),
      ...columns.map((c) => c.key),
      ...Object.keys(entry!.defaultContent),
    ];
    for (const key of everyKey) {
      expect(
        /price|amount|cost|rupee|from$/i.test(key) && key !== "priceLabel",
        `${key} looks like somewhere a price could be stored`,
      ).toBe(false);
    }
  });

  it("reads the cheapest live product instead of a stored number", () => {
    const section = body();

    /*
      NOT the rail. The rail is capped at ROW_CAP and ordered by curation, so
      its cheapest member is the cheapest of the first twelve — which was the
      true minimum only because no category here has twelve products yet, and
      nothing would have failed the day one did.
    */
    expect(section, "the card no longer reads the whole-category minimum").toContain(
      "props.categoryStartingPrices?.[slug]",
    );
    expect(section, "the price is back to the capped rail").not.toContain(
      "startingPriceOf(props.categoryRails",
    );
    expect(section, "a price is being taken from the row instead of the catalogue").not.toMatch(
      /item\.(price|startingFrom|amount)/,
    );
  });

  it("says nothing at all rather than a price it cannot stand behind", () => {
    /*
      `categoryRails` is absent in the builder preview by design, and a
      category with nothing live in it has no cheapest anything. Both must
      render no price line — not a zero, not a dash, not a guess.
    */
    const src = codeOf(read(RENDERER));
    const at = src.indexOf("function startingPriceOf(");
    expect(at, "startingPriceOf is gone").toBeGreaterThan(-1);
    const fn = src.slice(at, at + 420);

    expect(fn, "an empty category no longer yields nothing").toContain("null");
    expect(fn, "a zero or negative price would be shown as a real one").toMatch(
      /price > 0/,
    );
    expect(body(), "the price line is drawn even when there is no price").toContain(
      "price !== null ?",
    );
  });

  it("takes the minimum over the whole category, not over a capped rail", () => {
    /*
      The rails are sliced to ROW_CAP. A starting price taken from one is
      the cheapest of the first twelve products, which stops being the
      cheapest of the category the moment a thirteenth is added — silently,
      on a card whose whole job is to name that number.
    */
    const rails = codeOf(read("features/products/lib/homepage-rails.ts"));
    const at = rails.indexOf("export function categoryStartingPrices(");
    expect(at, "categoryStartingPrices is gone").toBeGreaterThan(-1);
    const fn = rails.slice(at, at + 700);

    expect(fn, "the price stopped using the catalogue's own membership rule").toContain(
      "filterProductsByCategory(",
    );
    expect(fn, "a cap crept into the whole-category minimum").not.toMatch(/\bslice\(/);
    expect(fn, "a free or unpriced product would set the starting price").toMatch(
      /price > 0/,
    );
  });

  it("draws nothing at all when the shop has added no cards", () => {
    expect(body()).toContain("if (items.length === 0) return null;");
  });

  it("lets the category name the card, so a rename reaches it", () => {
    // `label` is an override, not the source. Storing the name on the row
    // would be a second copy that stops agreeing with the catalogue.
    const section = body();

    expect(section).toContain("nameOf.get(slug)");
  });
});
