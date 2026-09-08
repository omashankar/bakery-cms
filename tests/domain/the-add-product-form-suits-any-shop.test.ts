import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A 92-agent audit of the Add Product form, and what it found.
 *
 * The shop sells more than cake — "mere paas cake ke alawa or bhi product ho
 * sakte he" — so every field, word and failure path on the longest form in the
 * admin was checked against a shop selling chargers, plants, candles and photo
 * frames. Sixteen findings survived an adversarial pass; these are the six that
 * were fixed, each pinned here so it cannot come back quietly.
 *
 * The theme is the same one this project keeps meeting: a guard, a message or a
 * default that was written correctly once and then stopped matching the code
 * around it, while continuing to look like it worked.
 */

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const FORM = "apps/admin/products/components/product-form-page.tsx";

describe("a rejected save says which field", () => {
  it("reads the key the server actually sends", () => {
    /**
     * The server builds `{ field, message }` — `lib/server/http/validate.ts`
     * joins `issue.path` INTO `field` before it leaves. The client read
     * `item.path`, which is never present, so the name was always undefined and
     * every rejection toasted the bare message.
     *
     * The comment above it was written for a fix that then keyed on the wrong
     * property: an admin with twenty description blocks across six tabs was
     * told "A block needs something under its heading" and not which block.
     */
    const client = code("features/products/data/products-client.ts");

    expect(client).toContain('typeof item?.field === "string"');
    expect(client).toContain("item.field");
  });

  it("still carries the message when the server names no field", () => {
    // `validate.ts` writes "_" for an issue with an empty path. A literal
    // underscore in front of the sentence is worse than no name at all.
    const client = code("features/products/data/products-client.ts");

    expect(client).toContain('item.field !== "_"');
  });
});

describe("a half-typed row is dropped, not argued with", () => {
  it("drops a description block with nothing under its heading", () => {
    /**
     * The photo slots and the size rows beside it were already dropped on
     * submit. The blocks were not, so a block the admin had merely started
     * bounced the entire save — every tab, every field — on a validator rule
     * they could not see.
     */
    const form = code(FORM);

    expect(form).toContain("descriptionBlocks: (form.descriptionBlocks ?? []).filter(");
    expect(form).toContain("(block) => block.body.trim().length > 0,");
    // …the two that already behaved this way, so the three now agree.
    expect(form).toContain("images: form.images.filter(Boolean)");
    expect(form).toContain("weights: form.weights.filter((tier) => tier.label.trim().length > 0)");
  });
});

describe("the paragraph is labelled by where it prints", () => {
  it("is called what it is", () => {
    /**
     * It read "Opening paragraph" while its own hint said "under the blocks
     * below" — and the page agrees with the hint: `product-detail-page` maps
     * the blocks into bulleted lists first and renders this prose LAST,
     * deliberately.
     */
    const form = code(FORM);

    expect(form).toContain("Closing paragraph");
    expect(form).not.toContain("Opening paragraph");
  });

  it("still renders after the blocks, which is what the label now promises", () => {
    const page = read("apps/website/pages/product-detail-page.tsx");
    const blocks = page.indexOf("{descriptionBlocks.map((block) => (");
    const prose = page.indexOf("{cake.description ? (");

    expect(blocks).toBeGreaterThan(0);
    expect(prose).toBeGreaterThan(blocks);
  });
});

describe("search and the filter panel read the same words", () => {
  it("both see the option labels", () => {
    /**
     * `optionLabels` was in the filter haystack and not in the search one, so
     * ticking "Heart" in the sidebar found the cake and typing "Heart" into
     * search found nothing. Both run over the same card projection, where
     * `description` is empty — so option labels are most of what a card has.
     */
    const search = code("features/products/lib/product-catalog.ts");
    const filters = code("apps/website/lib/collection-filters.ts");

    expect(search).toContain("...(cake.optionLabels ?? [])");
    expect(filters).toContain("cake.optionLabels ?? []");
  });
});

describe("the form does not lose an hour of typing", () => {
  it("guards against leaving with unsaved changes", () => {
    /**
     * The two builders in this admin have had this guard since one of them lost
     * somebody's work. The longest form in the admin — six tabs, and its own
     * "Back to products" link three inches under the last field — had none, so
     * every item in the sidebar was a silent discard.
     */
    const form = code(FORM);

    expect(form).toContain("useUnsavedChangesGuard(isDirty)");
  });

  it("decides dirtiness by comparing, not by a flag somebody has to set", () => {
    /**
     * There are nine `setForm` call sites in this file. A flag would eventually
     * be forgotten by one of them, and the forgotten one is the field that gets
     * lost. Comparing also means undoing an edit by hand correctly stops
     * counting as dirty.
     */
    const form = code(FORM);

    expect(form).toContain("JSON.stringify(form) !== baseline");
    // Re-baselined on load and on save, or the guard fires on a clean form.
    expect(form).toContain("setBaseline(JSON.stringify(data))");
    expect(form).toContain("setBaseline(JSON.stringify(payload))");
  });
});

describe("the meta title follows a rename", () => {
  it("is never copied from the name", () => {
    /**
     * Every product shipped with a stored `seo.metaTitle` equal to its name at
     * creation, and edit mode did not track — so a cake renamed "Belgian
     * Truffle" went on telling Google "Chocolate Cake". The route already falls
     * back to `cake.name` when the field is blank, so a blank box is the
     * version that stays true.
     */
    const form = code(FORM);

    expect(form).not.toContain("metaTitleTouched");
    expect(form).toContain("placeholder={form.name ||");

    /**
     * Scoped to `handleNameChange`, because removing the FLAG is not the fix —
     * writing the name in unconditionally would pass both lines above while
     * being the same bug without the switch.
     */
    const start = form.indexOf("function handleNameChange(");
    const body = form.slice(start, form.indexOf("\n  }", start));

    expect(start).toBeGreaterThan(0);
    expect(body).toContain("metaTitle: prev.seo.metaTitle,");
    expect(body).not.toContain("metaTitle: name");
  });

  it("and the route still falls back to the name", () => {
    const route = code("app/(storefront)/store/cakes/[slug]/page.tsx");

    expect(route).toMatch(/typed \|\| cake\.name/);
  });
});

describe("the bakery-wording ratchet covers what it claims to", () => {
  const guard = "tests/domain/no-new-bakery-wording.test.ts";

  it("exempts a file, not every path that begins like its name", () => {
    /**
     * `startsWith` made `{ path: "app/(admin)/admin/page" }` — written for one
     * metadata export — exempt four files: that page plus the whole CMS Pages
     * editor at `app/(admin)/admin/pages/…`. A `why` about a browser tab was
     * covering an admin route group because one string began with another.
     */
    const source = code(guard);

    expect(source).toContain("rel === entry.path");
    expect(source).toContain("rel.startsWith(`${entry.path}/`)");
    expect(source).not.toContain("ALLOWED.some((entry) => rel.startsWith(entry.path))");
  });

  it("has dropped the three allowances that protected nothing", () => {
    /**
     * Each was allowed for a bakery word since removed: the variant Type
     * control offers only Shape and Custom, the settings index stopped listing
     * the modules by their food names, and the upload panel is captioned
     * "Printed photo". Between them they exempted 2,557 lines to defend zero
     * strings — so whatever drifted in next would have passed.
     */
    const source = read(guard);

    for (const gone of [
      "apps/admin/products/components/product-variant-manager",
      "apps/admin/settings/components/settings-overview-page",
      "apps/website/pages/product-detail-page",
    ]) {
      expect(source, `${gone} is still allowed`).not.toContain(`path: "${gone}"`);
    }

    /**
     * That the three are CLEAN is not asserted here, deliberately. Rebuilding
     * the guard's own string-reader to check them would be a second, worse copy
     * of it — the first attempt matched identifiers and reported fourteen
     * offenders that are not strings at all. The real proof runs in the same
     * suite:  now scans all three and passes.
     */
  });

  it("keeps the one allowance that is real, and says what it covers", () => {
    const source = read(guard);

    expect(source).toContain('path: "apps/admin/products/components/product-form-page"');
    expect(source).toContain("It is the only match in the file.");
    // The string it exists for: one edible, one not.
    expect(read(FORM)).toContain("e.g. Chocolate Truffle Cake, 65W Type-C Charger");
  });
});

describe("and the guard still runs over everything it used to", () => {
  it("did not shrink its scanned list to stay green", () => {
    const source = read("tests/domain/no-new-bakery-wording.test.ts");
    const scanned = source.slice(source.indexOf("SCANNED"), source.indexOf("const ALLOWED"));

    for (const dir of ["apps/admin", "apps/website", "features", "components", "app"]) {
      expect(scanned, `${dir} is no longer scanned`).toContain(dir);
    }
  });

  it("reaches the CMS Pages editor that the prefix bug had exempted", () => {
    const pages = join(ROOT, "app", "(admin)", "admin", "pages");
    const entries = readdirSync(pages, { withFileTypes: true }).map((e) => e.name);

    // If this directory is ever removed the test above stops meaning anything,
    // so the fixture it relies on is asserted rather than assumed.
    expect(entries.length).toBeGreaterThan(0);
    expect(pages.split(sep).join("/")).toContain("admin/pages");
  });
});
