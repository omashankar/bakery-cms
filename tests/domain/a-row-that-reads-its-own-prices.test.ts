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
    expect(entry!.defaultContent.description).toBe("");
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

    expect(section, "the card no longer reads the category's own rail").toContain(
      "props.categoryRails?.[slug]",
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

    expect(fn, "an empty category no longer yields nothing").toContain(": null");
    expect(fn, "a zero or negative price would be shown as a real one").toMatch(
      /price > 0/,
    );
    expect(body(), "the price line is drawn even when there is no price").toContain(
      "price !== null ?",
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
