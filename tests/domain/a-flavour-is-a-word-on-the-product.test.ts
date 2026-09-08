import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { CollectionFiltersPanel } from "@/components/storefront/collection-filters-panel";

import {
  applyCollectionFilters,
  DEFAULT_COLLECTION_FILTERS,
  getFilterFlavourOptions,
  getFilterOptionFacets,
} from "@/apps/website/lib/collection-filters";
import { CATALOG_SECTIONS } from "@/features/catalog/lib/catalog-api";
import type { LandingProduct } from "@/constants/landing-data";

/**
 * A shop-wide list of flavours was a second answer to a question the product had
 * already answered.
 *
 * Catalog held a Flavours tab — a name and a slug per row — and the product form
 * had a dropdown that pointed at it. Beside that dropdown, on the same form, sat
 * a free-text "Flavour options" box that the shop typed for itself. The box is
 * what a customer was ever offered; the id the dropdown wrote reached no cart
 * line, no order, no invoice and no email. The list existed to be kept in step
 * with the products, and nothing else.
 *
 * So it has gone the way sizes went. The one place the taxonomy DID reach a
 * customer — the Flavour tick-list on Collections — now reads the products,
 * which is the only definition that cannot go stale: a flavour is offered as a
 * filter exactly when something in front of the customer is sold in it.
 */

const product = (over: Partial<LandingProduct>): LandingProduct =>
  ({
    id: "p1",
    name: "Thing",
    slug: "thing",
    description: "",
    price: 500,
    image: "",
    category: "Cakes",
    ...over,
  }) as LandingProduct;

describe("the Catalog no longer keeps a list of flavours", () => {
  it("offers the shop two sections to manage, not three", () => {
    expect([...CATALOG_SECTIONS]).toEqual(["categories", "occasions"]);
  });

  it("refuses a write naming the section that is gone", async () => {
    /**
     * The allowlist is the refusal, not the Mongoose schema: a path removed
     * from the schema is DROPPED silently under strict mode, which looks like
     * a successful save. Two independent allowlists answer here — the section
     * schema registry on the write, and the defaults map on the reset.
     */
    const { catalogSectionSchemas } = await import(
      "@/features/catalog/server/catalog.validators"
    );

    expect(Object.keys(catalogSectionSchemas).sort()).toEqual(["categories", "occasions"]);
    expect(Object.hasOwn(catalogSectionSchemas, "flavours")).toBe(false);
  });

  it("has nowhere left to put a flavour row", async () => {
    // The tab union and the store are what the screen and the dialog are built
    // from; a leftover key in either is a dead tab or an exhaustive-Record error.
    const utils = await import("@/features/catalog/lib/catalog-utils");
    const store = utils.defaultCatalogStore as unknown as Record<string, unknown>;

    expect(Object.keys(store).sort()).toEqual(["categories", "occasions", "updatedAt"]);
    expect("defaultFlavours" in utils).toBe(false);
  });

  it("no longer offers a writer for a list that is not there", async () => {
    const repository = await import("@/features/catalog/lib/catalog-repository");

    for (const gone of ["getFlavours", "createFlavour", "updateFlavour", "deleteFlavours", "getFlavourByName"]) {
      expect(gone in repository, `${gone} is still exported`).toBe(false);
    }
    // …and the two that remain are untouched.
    expect("createCategory" in repository).toBe(true);
    expect("createOccasion" in repository).toBe(true);
  });
});

describe("the filter offers what is on the page", () => {
  it("reads the flavours off the products being shown", () => {
    const options = getFilterFlavourOptions([
      product({ flavours: ["Vanilla", "Butterscotch"] }),
      product({ flavours: ["Vanilla"] }),
    ]);

    /**
     * Commonest FIRST, so a shop's usual flavours come before a one-off — and
     * the two names are chosen so that frequency order and alphabetical order
     * disagree. With Chocolate and Red Velvet they happen to match, and the
     * assertion would hold for a sort that ignored the counts entirely.
     */
    expect(options).toEqual(["Vanilla", "Butterscotch"]);
  });

  it("breaks a tie by name, so the order does not depend on catalogue order", () => {
    expect(
      getFilterFlavourOptions([product({ flavours: ["Vanilla", "Butterscotch"] })]),
    ).toEqual(["Butterscotch", "Vanilla"]);
  });

  it("does NOT file a variant option under the word flavour", () => {
    /**
     * This test used to assert the opposite, and the opposite was the bug.
     *
     * Reading `optionLabels` here meant every variant option in the catalogue
     * arrived under one hard-coded heading. On this shop that heading read
     * "Flavour: Regular, Eggless, Round, Square, Heart" — five ticks, not one of
     * them a flavour — and a shop selling chargers would have read "Flavour:
     * 65W, Type-C". The old test could not see it, because it fed ONE label and
     * never asked what heading the label ended up under.
     *
     * A variant option belongs to the group the shop typed it into, and
     * `getFilterOptionFacets` is where it goes now.
     */
    const cake = product({
      optionLabels: ["Butterscotch"],
      optionGroups: [{ name: "Egg preference", labels: ["Butterscotch"] }],
      flavours: [],
    });

    expect(getFilterFlavourOptions([cake])).toEqual([]);
    expect(getFilterOptionFacets([cake, product({ id: "z", slug: "z" })])).toEqual([
      { key: "egg preference", name: "Egg preference", options: ["Butterscotch"] },
    ]);
  });

  it("offers nothing to a shop that sells nothing by flavour", () => {
    // A charger shop gets no flavour filter, rather than six bakery words that
    // would hide its whole catalogue.
    expect(getFilterFlavourOptions([product({ name: "65W Charger" })])).toEqual([]);
  });

  it("ignores a blank entry rather than offering an empty tick", () => {
    expect(getFilterFlavourOptions([product({ flavours: ["  ", "", "Vanilla"] })])).toEqual([
      "Vanilla",
    ]);
  });

  it("forgets a flavour when the last product carrying it stops", () => {
    const before = getFilterFlavourOptions([product({ flavours: ["Pistachio"] })]);
    const after = getFilterFlavourOptions([product({ flavours: ["Vanilla"] })]);

    expect(before).toEqual(["Pistachio"]);
    expect(after).toEqual(["Vanilla"]);
  });

  it("never offers a tick that matches nothing", () => {
    /**
     * THE property the taxonomy could not give. A shop-wide list could hold
     * Butterscotch while nothing on the page was butterscotch — a tick that
     * empties the grid. The option list and the matcher now read the same two
     * fields, so every option is guaranteed to keep at least one product.
     */
    const shelf = [
      product({ id: "a", slug: "a", flavours: ["Chocolate"] }),
      product({ id: "b", slug: "b", optionLabels: ["Red Velvet"] }),
      product({ id: "c", slug: "c", name: "65W Charger" }),
    ];

    for (const option of getFilterFlavourOptions(shelf)) {
      const kept = applyCollectionFilters(shelf, {
        ...DEFAULT_COLLECTION_FILTERS,
        flavours: [option],
      });
      expect(kept.length, `"${option}" matched nothing`).toBeGreaterThan(0);
    }
  });
});

describe("the flavour lives on the product", () => {
  const FORM = "apps/admin/products/components/product-form-page.tsx";

  it("keeps the box the shop types its own flavours into", () => {
    // This was always there, beside the dropdown. It is the half that decided
    // what a customer saw, and it is the half that stays.
    const form = readFileSync(join(process.cwd(), FORM), "utf8");

    expect(form).toContain("Flavour options (comma-separated)");
    expect(form).toContain("flavourOptions");
  });

  it("no longer offers a flavour to pick from a list", () => {
    const form = readFileSync(join(process.cwd(), FORM), "utf8");

    expect(form).not.toContain("Select flavour");
    expect(form).not.toContain("adminFlavours");
  });

  it("survives the write path the admin form posts through", async () => {
    const { productFormSchema } = await import("@/features/products/server/product.validators");
    const { createEmptyProductForm } = await import(
      "@/features/products/lib/products-repository"
    );

    const parsed = productFormSchema.safeParse({
      ...createEmptyProductForm(),
      name: "Truffle",
      slug: "truffle",
      flavourOptions: ["Chocolate", "Red Velvet"],
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.flavourOptions).toEqual(["Chocolate", "Red Velvet"]);
  });

  it("drops the pointer into a list that no longer exists", async () => {
    /**
     * `flavourId` was a foreign key into the taxonomy. Kept, it would be a
     * dangling id on every product that had one — pointing at a row nothing
     * can look up, and reading as data to whoever finds it next.
     *
     * The VALIDATOR is not the thing that stops it: `productFormSchema` ends
     * in `.passthrough()`, so an unknown key survives parsing. What matters is
     * that nothing declares it any more, and that Mongoose has no path for it
     * (the case below). An old product loses it on its next save rather than
     * needing a migration.
     */
    const { productFormSchema } = await import("@/features/products/server/product.validators");

    expect("flavourId" in productFormSchema.shape).toBe(false);
    expect("flavourOptions" in productFormSchema.shape).toBe(true);
  });

  it("is not carried by Mongoose either", async () => {
    const { ProductModel } = await import("@/lib/server/db/models/product.model");
    const doc = new ProductModel({
      _id: "p-truffle",
      name: "Truffle",
      slug: "truffle",
      flavourId: "fl-chocolate",
      flavourOptions: ["Chocolate"],
    });

    const stored = doc.toObject() as { flavourId?: string; flavourOptions?: string[] };

    expect(stored.flavourId).toBeUndefined();
    // …while the product's own list is still a path the schema knows.
    expect(stored.flavourOptions).toEqual(["Chocolate"]);
  });

  it("crosses the storefront mapper, which is a whitelist and not a spread", async () => {
    const { mapAdminProductToStorefront } = await import(
      "@/features/products/lib/product-mapper"
    );

    const mapped = mapAdminProductToStorefront({
      id: "p-truffle",
      name: "Truffle",
      slug: "truffle",
      description: "",
      price: 500,
      images: ["/t.jpg"],
      categoryId: "c1",
      occasionIds: [],
      weights: [],
      status: "published",
      shapes: [],
      flavourOptions: ["Chocolate", "Red Velvet"],
      attributes: [],
      rating: 0,
      reviewCount: 0,
    } as never);

    expect(mapped.flavours).toEqual(["Chocolate", "Red Velvet"]);
  });
});

describe("the panel is handed the list rather than looking one up", () => {
  const shown: Array<() => void> = [];
  afterEach(() => {
    while (shown.length) shown.pop()?.();
  });

  function draw(flavourOptions: string[]) {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        createElement(CollectionFiltersPanel, {
          filters: DEFAULT_COLLECTION_FILTERS,
          onChange: () => {},
          flavourOptions,
        } as never),
      );
    });
    shown.push(() => {
      act(() => {
        root.unmount();
      });
      container.remove();
    });
    return container;
  }

  it("offers the flavours it was given", () => {
    expect(draw(["Butterscotch"]).textContent).toContain("Butterscotch");
  });

  it("offers none of the six the software used to ship with", () => {
    /**
     * The panel seeded itself from `DEFAULT_FILTER_FLAVOUR_OPTIONS` — six
     * bakery words baked into this software — and then swapped in whatever
     * localStorage held. A shop that sold none of them still painted all six,
     * every one a tick that empties the grid.
     */
    const html = draw([]).textContent ?? "";
    for (const shipped of ["Chocolate", "Vanilla", "Butterscotch", "Red Velvet", "Pistachio"]) {
      expect(html, shipped).not.toContain(shipped);
    }
  });
});

describe("both filter panels get the list", () => {
  it("hands it to the sidebar and to the sheet", () => {
    /**
     * Collections renders the panel TWICE — a sidebar on a wide screen and a
     * sheet on a phone. Wiring only the first is invisible on a laptop and
     * leaves every phone with an empty Flavour group.
     */
    const page = readFileSync(
      join(process.cwd(), "apps/website/pages/collections-page.tsx"),
      "utf8",
    );

    expect(page.split("flavourOptions={flavourOptions}").length - 1).toBe(2);
    expect(page).toContain("getFilterFlavourOptions(catalog)");
  });
});
