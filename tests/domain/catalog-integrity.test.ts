import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { selectHomepageCategories } from "@/features/products/lib/homepage-catalog";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

/** Comments stripped — `toContain` cannot tell code from a description of it. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/** A named function's body, brace-matched so an assertion cannot drift. */
function bodyOf(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`not found: ${signature}`);

  let angle = 0;
  let paren = 0;
  let open = -1;
  for (let i = start + signature.length - 1; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "<") angle += 1;
    else if (ch === ">") angle = Math.max(0, angle - 1);
    else if (ch === "(") paren += 1;
    else if (ch === ")") paren = Math.max(0, paren - 1);
    else if (ch === "{" && angle === 0 && paren === 0) {
      open = i;
      break;
    }
  }
  if (open < 0) throw new Error(`no body for: ${signature}`);

  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return stripComments(source.slice(start, i + 1));
    }
  }
  throw new Error(`unbalanced: ${signature}`);
}

/**
 * The number under a category on the storefront is counted, not declared.
 *
 * It was `category.cakeCount ?? <the real count>`, and the seed had typed a
 * `cakeCount` for nine categories — so the hand-typed number always won.
 * Measured on a real shop: 48 claimed under Birthday with none actually there,
 * and 271 claimed across all categories in a shop holding 25 products.
 *
 * Rendered by `CategoriesSection` in the homepage section renderer.
 */
describe("category counts come from the products", () => {
  const products = [
    { status: "published", categoryId: "cat-a" },
    { status: "published", categoryId: "cat-a" },
    { status: "draft", categoryId: "cat-a" },
    { status: "published", categoryId: "cat-b" },
  ];
  const categories = [
    { id: "cat-a", name: "A", slug: "a", image: "a.jpg", cakeCount: 48 },
    { id: "cat-b", name: "B", slug: "b", image: "b.jpg" },
    { id: "cat-c", name: "C", slug: "c", image: "c.jpg", cakeCount: 99 },
  ];

  it("ignores a hand-typed cakeCount", () => {
    const [a] = selectHomepageCategories(products, categories);
    expect(a?.count).toBe(2);
  });

  it("counts a category that never had one typed", () => {
    const [, b] = selectHomepageCategories(products, categories);
    expect(b?.count).toBe(1);
  });

  it("reports zero for a category with nothing in it, not the number claimed", () => {
    // This is the shape of the measured bug: 99 declared, nothing there.
    const [, , c] = selectHomepageCategories(products, categories);
    expect(c?.count).toBe(0);
  });

  it("counts published products only", () => {
    // cat-a has three products; one is a draft the customer cannot buy.
    const [a] = selectHomepageCategories(products, categories);
    expect(a?.count).not.toBe(3);
  });
});

/**
 * Each catalog section is a replace-all. Composing that payload before the
 * server's copy has arrived publishes whatever this browser held — the shipped
 * defaults on a fresh one.
 */
describe("the catalog gate guards the read, not just the write", () => {
  const source = read("features/catalog/lib/catalog-repository.ts");

  it("reading the cache never plants the defaults in it", () => {
    const fn = bodyOf(source, "export function loadCatalogStore(");
    // It used to answer an absent key by persisting `defaultCatalogStore` and
    // returning it, so the first read on a fresh browser created the seed that
    // every later write then published.
    expect(fn).not.toContain("persist(");
    expect(fn).toContain("return defaultCatalogStore");
  });

  it("the hydrated read is the only way to get a store to publish", () => {
    const fn = bodyOf(source, "async function hydratedStore(");
    expect(fn).toContain("catalogHydration.waitForSettled()");
    expect(fn).toContain("return null");
  });

  it("every mutation starts from the hydrated read", () => {
    const code = stripComments(source);
    const mutations = [
      "createCategory", "updateCategory", "deleteCategories",
      "createFlavour", "updateFlavour", "deleteFlavours",
      "createOccasion", "updateOccasion", "deleteOccasions",
      "createWeightOption", "updateWeightOption", "deleteWeightOptions",
    ];

    for (const name of mutations) {
      const fn = bodyOf(code, `export async function ${name}(`);
      expect(fn, `${name} must await the gate before reading`).toContain("await hydratedStore()");
      // The ungated read is what made the payload the demo seed.
      expect(fn, `${name} must not read the cache directly`).not.toContain("loadCatalogStore()");
    }
  });

  it("updateStore is handed the store rather than reading one", () => {
    // The signature is the enforcement: a caller cannot pass a store it did not
    // get from the gate, because there is nowhere else to get one.
    const fn = bodyOf(source, "async function updateStore(");
    expect(fn).toMatch(/current: CatalogStore/);
    expect(fn).not.toContain("loadCatalogStore()");
  });

  it("rolls a refused write back, but only if it is still the one cached", () => {
    const fn = bodyOf(source, "function rollBackCache(");
    // Restoring unconditionally destroys a concurrent save the server accepted.
    expect(fn).toContain("localStorage.getItem(STORAGE_KEY) !== JSON.stringify(attempted)");

    const update = bodyOf(source, "async function updateStore(");
    expect(update).toContain("if (!persisted) rollBackCache(previousRaw, saved)");
    // A refused write left in the cache reaches the server on the next accepted
    // write to any section, because every section push sends the whole store.
    expect(update).toContain("value: persisted ? saved : current");
  });

  it("gives every item an id two admins cannot both mint", () => {
    const code = stripComments(source);
    expect(code).not.toMatch(/id: `(cat|fl|oc|wt)-\$\{Date\.now\(\)\}`/);
    expect(bodyOf(source, "function newId(")).toContain("crypto.randomUUID");
  });
});

/** The screen, and what it tells the admin about what it is showing. */
describe("the catalog screen", () => {
  const page = read("apps/admin/catalog/components/catalog-admin-page.tsx");

  it("re-reads when the server's taxonomy lands", () => {
    // It read localStorage once at mount and never again, so on a fresh browser
    // it showed the shipped defaults for the whole visit.
    expect(page).toContain("CATALOG_UPDATED_EVENT");
    expect(page).toContain("CATALOG_HYDRATION_EVENT");
    expect(page).toMatch(/addEventListener\(CATALOG_UPDATED_EVENT/);
    expect(page).toMatch(/addEventListener\(CATALOG_HYDRATION_EVENT/);
  });

  it("disables the buttons rather than guarding inside the handlers", () => {
    const code = stripComments(page);
    expect(code).toContain('const canWrite = hydration === "ready"');
    // Add, delete and reset — a button that looks live and does nothing is the
    // same lie in a different place.
    expect((code.match(/disabled=\{!canWrite\}/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("says which taxonomy is on screen while it is not the shop's", () => {
    expect(page).toContain("Loading this shop's catalog");
    expect(page).toContain("You are looking at the built-in defaults");
  });

  it("asks before replacing all four taxonomies, and obeys the answer", () => {
    const fn = bodyOf(page, "async function handleReset(");
    expect(fn).toContain("window.confirm");
    expect(fn).toContain("Reset the whole catalog?");
    // Asking is not enough — the answer has to stop the write. Deleting the
    // early return leaves a dialog that changes nothing, which is worse than no
    // dialog at all.
    expect(fn).toMatch(/const ok = window\.confirm\(/);
    expect(fn).toMatch(/if \(!ok\) return;/);
    expect(fn.indexOf("if (!ok) return;")).toBeLessThan(fn.indexOf("resetCatalogStore()"));
  });

  it("warns before orphaning the products in a category, and obeys the answer", () => {
    const fn = bodyOf(page, "async function handleDelete(");
    expect(fn).toContain("orphanCount()");
    expect(fn).toMatch(/const ok = window\.confirm\(/);
    expect(fn).toMatch(/if \(!ok\) return;/);
    expect(fn.indexOf("if (!ok) return;")).toBeLessThan(fn.indexOf("await remove(selectedIds)"));
  });

  it("shows the counted number of cakes, not the typed one", () => {
    const code = stripComments(page);
    expect(code).toContain("productsByCategory.get(item.id)");
    expect(code).not.toContain("item.cakeCount");
  });
});

/**
 * `getCategoryById` reads a localStorage-backed store. On the server that is
 * `defaultCatalogStore` — the DEMO taxonomy — so every server-rendered product
 * page resolved its category against the shipped list.
 */
describe("server-rendered products use the shop's own category names", () => {
  it("the mapper accepts the real names", () => {
    const source = read("features/products/lib/product-mapper.ts");
    const fn = bodyOf(source, "export function mapAdminProductToStorefront(");
    expect(fn).toContain("categoryNames?.get(cake.categoryId)");
  });

  it("the server service supplies them from the database", () => {
    const source = read("features/products/data/products-service.ts");
    expect(bodyOf(source, "async function categoryNames(")).toContain("getCatalog()");

    for (const fn of [
      "export async function getStorefrontProducts(",
      "export async function getStorefrontProductBySlug(",
      "export async function getHomepageRails(",
    ]) {
      expect(bodyOf(source, fn), `${fn} must pass the real names`).toMatch(/categoryNames\(\)|names\)/);
    }
  });

  it("never maps by bare reference, which would pass the array index", () => {
    // `.map(mapAdminProductToStorefront)` hands the INDEX to the second
    // parameter, which is now the category lookup.
    for (const file of [
      "features/products/data/products-service.ts",
      "features/products/lib/product-mapper.ts",
    ]) {
      expect(stripComments(read(file))).not.toContain(".map(mapAdminProductToStorefront)");
    }
  });
});
