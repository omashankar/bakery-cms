import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A screen that tells you where to go has to be right about where that is.
 *
 * Nine agents read this form and the sixteen settings screens against one
 * question — can a shop owner open this and know what to do without guessing —
 * and the loudest pattern was not a missing explanation. It was explanations
 * that had gone stale: a subtitle naming two tabs deleted for being our words
 * rather than the shop's, a help line pointing "below" at rows that moved to
 * another tab, and a publish refusal — the one moment an owner is blocked and
 * told exactly where to go — naming the wrong tab.
 *
 * Every one of them was written true. Each went wrong when something else moved
 * and nothing tied the two together. That is what this file is: the ties.
 */

const FORM = "apps/admin/products/components/product-form-page.tsx";
const MANAGER = "apps/admin/products/components/product-variant-manager.tsx";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

/** The tab a marker sits in — the same reading the six-questions file takes. */
function tabOf(source: string, marker: string): string | null {
  const at = source.indexOf(marker);
  if (at < 0) return null;
  let open: string | null = null;
  for (const m of source.slice(0, at).matchAll(/<TabsContent value="([a-z]+)"|<\/TabsContent>/g)) {
    open = m[1] ?? null;
  }
  return open;
}

describe("every pointer names somewhere that exists", () => {
  const form = code(FORM);

  it("sends an unpriced size to the tab the size rows are actually on", () => {
    /**
     * It said "Price & stock." — and the rows it names are on Options. The
     * refusal beside it, for the BASE price, correctly says "Price & stock, at
     * the top", so the wrong one sat next to a right one and read as
     * authoritative.
     */
    expect(form).toContain("would sell for nothing. Options, at the top.`");
    expect(tabOf(form, 'htmlFor="weightLabel"')).toBe("options");
  });

  it("stops telling the base price that sizes are below it", () => {
    // There is nothing below it on that tab but stock.
    expect(form).not.toContain("Add sizes below");
  });

  it("and the size rows really are above the option blocks it points at", () => {
    expect(form.indexOf('htmlFor="weightLabel"')).toBeLessThan(
      form.indexOf("<ProductVariantManager"),
    );
  });
});

describe("the first line anybody reads", () => {
  const form = code(FORM);

  it("names no section that is not on the screen", () => {
    /**
     * "Create a cake with pricing, commerce options, classification, and SEO."
     * — "Commerce" and "Classification" are the two tab names this file deleted
     * for being ours rather than the shop's, kept alive in the one line meant to
     * orient a first-timer. "Classification" is not a word a shop uses at all.
     */
    const subtitle = form.slice(form.indexOf("<AdminPageHeader"), form.indexOf("actions={"));

    expect(subtitle).not.toContain("classification");
    expect(subtitle).not.toContain("commerce options");
  });

  it("says what to do first, and names the button that does it", () => {
    // Not a list of the six tabs: they are rendered in full immediately below,
    // so a list would be the same words twice and still not say what to do.
    expect(form).toContain("Name it, price it, add a photo, then ${publishLabel}");
    expect(form).toContain("The other tabs can wait");
  });

  it("and the summary card describes what the card holds", () => {
    // It promised stock and classification, and showed neither.
    expect(form).not.toContain("Stock, options and classification");
    expect(form).toContain("Option blocks and review scores");
    // "Variant groups" is the developer word the tab strip was renamed away from.
    expect(form).not.toContain("Variant groups:");
  });
});

describe("what a shop is asked, in the order it decides it", () => {
  const form = code(FORM);

  it("puts where a product is filed directly under its name", () => {
    /**
     * The second field used to be the web address — the one box on the tab a
     * shop should not touch, filled in for them — while the category, which
     * publishing refuses without, sat below it past a rule. The refusal says
     * "Basics, under the name", and that is now literally true.
     */
    const name = form.indexOf('htmlFor="name"');
    const category = form.indexOf('htmlFor="category"');
    const occasions = form.indexOf("adminOccasions()");
    const slug = form.indexOf('htmlFor="slug"');

    expect(name).toBeLessThan(category);
    expect(category).toBeLessThan(occasions);
    expect(occasions).toBeLessThan(slug);
  });

  it("keeps all four on Basics", () => {
    for (const marker of ['htmlFor="name"', 'htmlFor="category"', "adminOccasions()", 'htmlFor="slug"']) {
      expect(tabOf(form, marker), marker).toBe("basics");
    }
  });

  it("divides what it IS from where it LIVES", () => {
    // The rule used to cut the name off from the category — the one pair a shop
    // names in the same breath.
    const rule = form.indexOf("<Separator />", form.indexOf("adminOccasions()"));
    expect(rule).toBeGreaterThan(0);
    expect(rule).toBeLessThan(form.indexOf('htmlFor="slug"'));
  });
});

describe("every section on the Options tab has a name", () => {
  const form = code(FORM);

  it("names the run of ticks that used to just begin", () => {
    // Two headings above it said what they held. This one started mid-tab with
    // three unlabelled controls.
    expect(form).toContain("What you ask the customer for");
    expect(tabOf(form, "What you ask the customer for")).toBe("options");
  });

  it("stops the section sharing the tab's own name", () => {
    // Both were "Options", so the heading read as the tab heading repeated and
    // the sections beside it looked like they belonged to something else.
    expect(code(MANAGER)).toContain("Extras and facts");
    expect(code(MANAGER)).not.toContain('font-medium">Options</p>');
  });

  it("puts the one thing the customer never sees last, and says so", () => {
    /**
     * "Flavour options" sat among the controls that DO put something on the
     * page, with no help line of its own — the only field on the tab without
     * one. It feeds the listing filters and nothing else.
     */
    const ticks = form.indexOf("What you ask the customer for");
    const flavour = form.indexOf('htmlFor="flavourOptions"');

    expect(flavour).toBeGreaterThan(ticks);
    expect(form).toContain("Words a customer can narrow the shop by on the listing pages");
    expect(form).toContain("This puts no picker on the {productLower} page");
  });
});
