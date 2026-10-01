/**
 * A DEPARTMENT — the kind of thing, above the category that says which kind.
 *
 * The shop said it will sell cakes, flowers, plants, gifts, chocolates,
 * fashion, mobiles, electronics, beauty, home, toys and sports. Its catalogue
 * had three FLAT lists and no way to say that Chocolate Cakes belongs under
 * CAKES and Smartphones under MOBILES — so a shop selling a dozen kinds of
 * thing had one undifferentiated pile of categories.
 *
 * MEMBERSHIP LIVES ON THE DEPARTMENT, exactly as a collection already holds
 * its `productIds`. Not a parent pointer on the category: Roses belongs under
 * FLOWERS and under GIFTS, and one parent cannot say that.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  catalogSectionDefaults,
  defaultCatalogStore,
  departmentFor,
  findSlugClash,
  offeredAxes,
  offeredRows,
  slugPeers,
} from "@/features/catalog/lib/catalog-utils";
import {
  CATALOG_SECTIONS,
  catalogSectionSchemas,
  departmentsSchema,
} from "@/features/catalog/server/catalog.validators";
import { labelOverridesSchema } from "@/features/settings/server/settings.validators";
import { resolveLabels } from "@/config/business-labels";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const dept = (over: Record<string, unknown> = {}) => ({
  id: "dept-cakes",
  name: "Cakes",
  slug: "cakes",
  categoryIds: ["cat-chocolate"],
  ...over,
});

describe("a department is a row the shop writes", () => {
  it("survives the validator with its members intact", () => {
    /*
      The Mongoose schema this feeds is STRICT: an undeclared path is dropped
      on write while the API answers 200, which this repo's own model docblock
      says it has hit four times. The schema half of that is asserted here; the
      model half is asserted by the source check below, because a unit test
      cannot see a strict-mode drop without a database.
    */
    const parsed = departmentsSchema.safeParse([dept({ categoryIds: ["a", "b"] })]);
    expect(parsed.success).toBe(true);
    expect((parsed as { data: { categoryIds: string[] }[] }).data[0].categoryIds).toEqual([
      "a",
      "b",
    ]);

    const model = read("lib/server/db/models/catalog.model.ts");
    expect(model, "the document has nowhere to put a department").toContain("departments:");
  });

  it("can be named and filled later, like the collection beside it", () => {
    /*
      A shop names the department first and files things under it second. A
      write that 400s on an empty one would make the screen unable to save the
      row it just asked them to name.
    */
    const parsed = departmentsSchema.safeParse([{ id: "d1", name: "Mobiles", slug: "mobiles" }]);
    expect(parsed.success).toBe(true);
    expect((parsed as { data: { categoryIds: string[] }[] }).data[0].categoryIds).toEqual([]);
  });

  it("is a section the server, the browser and Reset all agree on", () => {
    /*
      Three lists that must contain the same words. A section with a schema and
      no default accepts writes and then 404s on its own Reset button — one
      enumerated list silently excluding a member.
    */
    expect(CATALOG_SECTIONS).toContain("departments");
    expect(Object.keys(catalogSectionSchemas)).toContain("departments");
    expect(
      Object.hasOwn(catalogSectionDefaults, "departments"),
      "Reset has no entry for departments",
    ).toBe(true);
    expect(catalogSectionDefaults.departments).toEqual([]);
  });

  it("and ships BLANK, because a trade is not ours to choose", () => {
    /*
      Shipping CAKES and FLOWERS would be this software telling a shop what it
      sells, and then heading its storefront with departments nobody made.
    */
    expect(defaultCatalogStore.departments).toEqual([]);
  });
});

describe("what the storefront is offered", () => {
  it("does not offer a department with nothing filed under it", () => {
    /*
      A link to an empty grid, answered from ids already in hand — the same
      rule the empty collection follows, and without reading one product.
    */
    const offered = offeredAxes({
      categories: [{ id: "cat-chocolate", name: "Chocolate", slug: "chocolate" }],
      occasions: [],
      collections: [],
      departments: [dept(), dept({ id: "dept-empty", slug: "empty", categoryIds: [] })],
    });

    expect(offered.departments.map((row) => row.slug)).toEqual(["cakes"]);
  });

  it("and every existing caller still compiles without passing any", () => {
    /*
      Every shop is here today. The argument is optional and the answer is an
      empty list, so nothing that predates departments has to change.
    */
    const offered = offeredAxes({ categories: [], occasions: [], collections: [] });
    expect(offered.departments).toEqual([]);
  });
});

describe("a category filed in two departments", () => {
  /*
    THE CASE THAT DECIDED THE MODEL. Roses under FLOWERS and under GIFTS is
    normal for the shop that named both in one sentence, and it is exactly
    what a parent pointer could not express.
  */
  const flowers = { id: "d-flowers", name: "Flowers", slug: "flowers", categoryIds: ["cat-roses"] };
  const gifts = { id: "d-gifts", name: "Gifts", slug: "gifts", categoryIds: ["cat-roses"] };

  it("is allowed, and the trail picks the one the shop put first", () => {
    expect(departmentFor([{ ...flowers, sortOrder: 1 }, { ...gifts, sortOrder: 0 }], "cat-roses")?.name).toBe(
      "Gifts",
    );
    /*
      SWAPPED. This is the assertion that proves the tiebreak is the shop's own
      ordering rather than the order the rows happen to sit in — the same list,
      the other answer.
    */
    expect(departmentFor([{ ...flowers, sortOrder: 0 }, { ...gifts, sortOrder: 1 }], "cat-roses")?.name).toBe(
      "Flowers",
    );
  });

  it("and nothing is claimed for a category nobody filed", () => {
    expect(departmentFor([flowers, gifts], "cat-nobody")).toBeUndefined();
    expect(departmentFor([flowers, gifts], undefined)).toBeUndefined();
  });

  it("and a switched-off department does not head anything", () => {
    expect(departmentFor([{ ...flowers, isActive: false }], "cat-roses")).toBeUndefined();
  });
});

describe("the shop's own word for it", () => {
  it("resolves, and an override survives the write", () => {
    /*
      `labelOverridesSchema` has NO `.passthrough()`, deliberately — a word
      declared in the type and missing from the schema is stripped on write
      while the API answers 200, and the shop's own noun silently never saves.
    */
    expect(resolveLabels().departmentWord).toBe("Department");
    expect(resolveLabels({ departmentWord: "Aisle" }).departmentWord).toBe("Aisle");

    const parsed = labelOverridesSchema.safeParse({ departmentWord: "Aisle" });
    expect(parsed.success).toBe(true);
    expect((parsed as { data: { departmentWord?: string } }).data.departmentWord).toBe("Aisle");
  });
});

describe("the header still reaches no product", () => {
  it("not through the department reader either", () => {
    /*
      The line this whole catalogue design holds. A department's own page is
      deferred for exactly this reason: there is no caching anywhere and
      `getStorefrontProductCards` is already awaited by nine routes including
      cart and checkout.
    */
    const reader = code("apps/website/lib/storefront-categories.server.ts");
    expect(reader).not.toMatch(/getStorefrontProductCards|products-service|listAll/);

    const chrome = code("apps/website/lib/storefront-chrome.server.ts");
    expect(chrome).not.toContain("getStorefrontProductCards");
  });
});

describe("the document has somewhere to put it", () => {
  it("and without the declaration Mongoose would silently drop it", async () => {
    /*
      THE HALF NO BROWSER TEST COULD PROVE, and I tried.

      Removing `departments` from the model and re-running the end-to-end spec
      left it GREEN — not because the guard was weak but because Mongoose
      caches a registered model for the life of the process, and the dev
      server had already compiled the schema WITH the path. Editing the source
      changed nothing it was using. That is a recorded trap in this repo and
      it is exactly the shape of failure this case exists to stop: a write
      dropped in silence while the API answers 200.

      So it is proven HERE, in a fresh schema built both ways in this process.
      No database, no server, no cache.
    */
    const mongoose = (await import("mongoose")).default;
    const row = { id: "d1", name: "Cakes", slug: "cakes", categoryIds: ["c1"] };

    const build = (declared: boolean, name: string) => {
      const fields: Record<string, unknown> = {
        categories: { type: [mongoose.Schema.Types.Mixed], default: [] },
      };
      if (declared) fields.departments = { type: [mongoose.Schema.Types.Mixed], default: [] };
      const Model = mongoose.model(name, new mongoose.Schema(fields));
      const stored = new Model({ departments: [row] }).toObject() as {
        departments?: unknown[];
      };
      return stored.departments?.length ?? 0;
    };

    expect(build(true, "ProbeWith"), "a declared path did not survive").toBe(1);
    expect(
      build(false, "ProbeWithout"),
      "the schema is not strict, so this guard proves nothing",
    ).toBe(0);

    /* And the repo's own model declares it. */
    const model = read("lib/server/db/models/catalog.model.ts");
    expect(model).toMatch(/^\s*departments: \{ type: \[mongoose\.Schema\.Types\.Mixed\]/m);
    expect(model, "the schema was made lax, which would hide the next dropped field").not.toMatch(
      /strict:\s*false/,
    );
  });
});

describe("what a new slug has to be unique against", () => {
  /**
   * A DEPARTMENT WAS CHECKED AGAINST EVERY LIST EXCEPT ITS OWN.
   *
   * `existingSlugs` in the Catalog dialog returned
   * `[...getCategories(), ...getCollections()]` for every tab that is not
   * `occasions` — departments reached that fall-through. Both directions of
   * that were live on this shop:
   *
   *   - TWO DEPARTMENTS AT ONE SLUG SAVED WITHOUT A WORD. The create form
   *     derives the slug from the name, so typing "Gifts" twice produces
   *     `gifts` twice. `offeredRows` then dedupes by slug and keeps the
   *     FIRST, so the second department never drew its heading, its categories
   *     fell into the unheaded leftover block beside the genuinely unfiled
   *     ones, and the product trail lost its department too — `departmentFor`
   *     runs the same dedupe.
   *
   *   - AND A DEPARTMENT WAS REFUSED AN ADDRESS NOTHING SERVES. This shop has
   *     a category called Pastries, so naming a department "Pastries" was
   *     refused with "already used by Pastries" for a slug no route resolves.
   *     There is no /store/departments/<slug> page: the menu draws a department
   *     as a heading and the trail as a word, both deliberately unlinked.
   *
   * The rule is `slugPeers` now, beside `findSlugClash` and the `offeredRows`
   * dedupe that gives a duplicate slug its teeth — because the cost of one is
   * paid three files from where the check was written.
   */
  const lists = {
    categories: [{ id: "c1", name: "Pastries", slug: "pastries" }],
    occasions: [{ id: "o1", name: "Birthday", slug: "birthday" }],
    collections: [{ id: "l1", name: "Premium", slug: "premium" }],
    departments: [{ id: "d1", name: "Gifts", slug: "gifts" }],
  };

  it("checks a department against departments, and nothing else", () => {
    const peers = slugPeers("departments", lists);
    expect(peers.map((row) => row.slug)).toEqual(["gifts"]);

    /* The half that saved silently. */
    expect(
      findSlugClash(peers, "gifts")?.name,
      "a second department at one slug is still accepted",
    ).toBe("Gifts");

    /* The half that refused an address nothing serves. */
    expect(
      findSlugClash(peers, "pastries"),
      "a department is still refused a category's slug",
    ).toBeUndefined();
  });

  it("and the storefront is what makes that necessary", () => {
    /*
      NOT A STYLE RULE. Two departments at one slug, through the real
      `offeredRows`: one comes back. So the admin accepting both is the admin
      accepting a row the storefront throws away.
    */
    const twice = [
      { id: "d1", name: "Gifts", slug: "gifts", sortOrder: 0, categoryIds: ["c1"] },
      { id: "d2", name: "Gifts", slug: "gifts", sortOrder: 1, categoryIds: ["c2"] },
    ];
    expect(offeredRows(twice).map((row) => row.id)).toEqual(["d1"]);
    expect(departmentFor(twice, "c2"), "the dropped department still files its category").toBeUndefined();
  });

  it("leaves the three lists that already had a rule exactly as they were", () => {
    /*
      THE REGRESSION THIS COULD HAVE BEEN. An occasion is unique among
      occasions — checking it against categories answered "already used by
      Birthday" for a slug it had held all along. A category and a collection
      share /store/collections/<slug>, so they are checked against each other.
    */
    expect(slugPeers("occasions", lists).map((row) => row.slug)).toEqual(["birthday"]);
    expect(slugPeers("categories", lists).map((row) => row.slug)).toEqual([
      "pastries",
      "premium",
    ]);
    expect(slugPeers("collections", lists).map((row) => row.slug)).toEqual([
      "pastries",
      "premium",
    ]);
  });

  it("and the admin asks the shared rule rather than spelling it again", () => {
    const dialog = readFileSync(
      join(process.cwd(), "apps/admin/catalog/components/catalog-form-dialog.tsx"),
      "utf8",
    );
    expect(dialog, "the dialog does not use the shared rule").toContain("slugPeers(tab, {");
    expect(dialog, "the rule is written out again beside the shared one").not.toMatch(
      /tab === "departments"\)\s*return/,
    );
  });
});
