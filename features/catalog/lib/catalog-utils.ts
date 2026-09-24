import { categories } from "@/constants/landing-data";
import type {
  ProductCategory,
  ProductCollection,
  ProductOccasion,
} from "@/types/product";
import type { CatalogStore } from "@/types/catalog";

function nowIso(): string {
  return new Date().toISOString();
}


export const defaultCategories: ProductCategory[] = [
  ...categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    image: category.image,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  })),
  {
    id: "cat-chocolate",
    name: "Chocolate",
    slug: "chocolate",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-premium",
    name: "Premium",
    slug: "premium",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "cat-classic",
    name: "Classic",
    slug: "classic",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  /*
    "cat-seasonal" was here, with slug "seasonal" — the SAME slug as the
    Seasonal row spread in from landing-data above it. `getStorefrontCategories`
    de-dupes by slug and keeps the FIRST, so this one was unreachable: its
    products could not be browsed to, with no 404 and no error anywhere. Every
    fresh install shipped the collision, and so did every "Reset defaults" on
    the Catalog screen.

    Removing the duplicate rather than renaming it, because the row it collided
    with is the one that was always winning.
  */
];


export const defaultOccasions: ProductOccasion[] = [
  { id: "oc-birthday", name: "Birthday", slug: "birthday", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "oc-wedding", name: "Wedding", slug: "wedding", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "oc-anniversary", name: "Anniversary", slug: "anniversary", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "oc-corporate", name: "Corporate", slug: "corporate", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

/**
 * EMPTY, deliberately, unlike the two lists above.
 *
 * Categories and occasions ship with a starter list because a shop cannot
 * file a product without at least one category, and an empty Catalog screen
 * reads as broken. A collection is the opposite: it is a curation, and a
 * shipped one would put a group on the storefront that the owner never made
 * and cannot explain — with products in it chosen by nobody.
 *
 * This is also what `Reset defaults` restores, which is the other reason it
 * must be empty: resetting collections should clear them, not conjure some.
 */
export const defaultCollections: ProductCollection[] = [];

/**
 * What `Reset defaults` restores, PER SECTION.
 *
 * Lives here rather than inside the service so it can be checked against the
 * section schemas without importing Mongoose. A section with a schema but no
 * entry in this map accepts writes and then 404s on its own Reset button —
 * one enumerated list silently excluding a member, which is a shape this
 * repo has been bitten by more than once.
 */
export const catalogSectionDefaults: Record<string, unknown> = {
  categories: defaultCategories,
  occasions: defaultOccasions,
  collections: defaultCollections,
};

export const defaultCatalogStore: CatalogStore = {
  categories: defaultCategories,
  occasions: defaultOccasions,
  collections: defaultCollections,
  updatedAt: nowIso(),
};

/**
 * The row already using this slug, if any — excluding the one being edited.
 *
 * Nothing enforced slug uniqueness anywhere: the server schema asks only for
 * `min(1)`. And a collision does not fail loudly, it fails silently —
 * `getStorefrontCategories` de-dupes by slug and keeps the FIRST row, so the
 * second is simply unreachable, its products unbrowsable, with no 404 and no
 * error. The shipped taxonomy carried exactly that (two Seasonal categories),
 * and every fresh install and every "Reset defaults" reproduced it.
 *
 * A pure function rather than a check inside the dialog, so the rule can be
 * tested without rendering a modal.
 */
export function findSlugClash<T extends { id: string; name: string; slug: string }>(
  rows: readonly T[],
  slug: string,
  editingId?: string | null,
): T | undefined {
  const wanted = slug.trim().toLowerCase();
  if (!wanted) return undefined;
  return rows.find((row) => row.id !== editingId && row.slug.trim().toLowerCase() === wanted);
}

/*
  `weightsToProductWeights` used to live here — base price plus each catalog
  size's modifier, which is how a product got its tiers. Sizes are typed on
  the product now, so there is nothing to derive them from and nothing to
  derive them for.
*/

/**
 * Which collections hold a product, after an edit — the one rule, for both
 * sides of it.
 *
 * Two callers, and they are the reason this is here rather than in the
 * repository beside its writer. The product form ticks a collection and the
 * admin writes it from the browser; a DELETED product has to come out of every
 * collection and the server does that, in a `server-only` module that must not
 * import a repository built on localStorage. Removing everywhere is the same
 * function with an empty list of wanted ids.
 */
export function collectionsWithProduct(
  collections: readonly ProductCollection[],
  productId: string,
  collectionIds: readonly string[],
): { next: ProductCollection[]; changed: number } {
  const wanted = new Set(collectionIds);
  let changed = 0;

  const next = collections.map((collection) => {
    const ids = collection.productIds ?? [];
    const has = ids.includes(productId);
    const should = wanted.has(collection.id);
    /*
      UNTOUCHED when nothing changes, and the identity matters: each section is
      a replace-all write, so a collection rebuilt for no reason is a curated
      order rewritten by a product save that had nothing to do with it.
    */
    if (has === should) return collection;

    changed += 1;
    return {
      ...collection,
      /* Appended, never inserted — see the note on the caller. */
      productIds: should ? [...ids, productId] : ids.filter((id) => id !== productId),
    };
  });

  return { next, changed };
}
