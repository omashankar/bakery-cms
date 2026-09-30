import { categories } from "@/constants/landing-data";
import type {
  ProductCategory,
  ProductCollection,
  ProductDepartment,
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
 * EMPTY, and for the same reason as the line above.
 *
 * A department is a decision about what a shop SELLS. Shipping CAKES and
 * FLOWERS and MOBILES would be this software telling a shop what its trade
 * is, and then heading its storefront with departments nobody created and
 * nothing is filed under.
 *
 * It is what `Reset defaults` restores too, which is the other reason it must
 * be empty: resetting departments should clear them, not conjure some.
 */
export const defaultDepartments: ProductDepartment[] = [];

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
  departments: defaultDepartments,
  categories: defaultCategories,
  occasions: defaultOccasions,
  collections: defaultCollections,
};

export const defaultCatalogStore: CatalogStore = {
  departments: defaultDepartments,
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

/**
 * The rows a shop is OFFERING, in the order it put them.
 *
 * Three things, together, because all three readers below need all three and
 * doing them separately is how they drifted: each list had its own copy of the
 * dedupe and only one of them was a named function.
 *
 *  - SWITCHED OFF rows are dropped. `isActive` is optional, and absent means
 *    ON — a shop that has never seen the switch has every row showing, which
 *    is what it had before the switch existed. Only an explicit `false` hides
 *    anything.
 *  - ORDERED by `sortOrder`, lowest first. A row with none sorts after every
 *    numbered one and otherwise keeps its stored position, so a shop that
 *    orders three rows out of eleven gets those three at the top and the rest
 *    exactly where they were.
 *  - DEDUPED by slug, first row wins. A second row at one slug is unreachable
 *    — the resolver takes the first — so returning it offers a link that does
 *    not go where its label says.
 *
 * Sorted BEFORE the dedupe, so that when two rows share a slug the one the
 * shop ordered first is the one kept, rather than whichever was created first.
 */
export function offeredRows<T extends { slug?: string; isActive?: boolean; sortOrder?: number }>(
  rows: readonly T[],
): T[] {
  const live = rows.filter((row) => row.isActive !== false);

  const ordered = [...live].sort((a, b) => {
    const left = typeof a.sortOrder === "number" ? a.sortOrder : Number.POSITIVE_INFINITY;
    const right = typeof b.sortOrder === "number" ? b.sortOrder : Number.POSITIVE_INFINITY;
    if (left !== right) return left - right;
    /* Equal, or both unset: the stored order stands. */
    return live.indexOf(a) - live.indexOf(b);
  });

  const bySlug = new Map<string, T>();
  for (const row of ordered) {
    if (row.slug && !bySlug.has(row.slug)) bySlug.set(row.slug, row);
  }
  return [...bySlug.values()];
}

/**
 * THE WHOLE RULE, ACROSS ALL THREE AXES — the one place that decides what a
 * customer is offered, so an admin screen cannot offer what the storefront
 * will drop.
 *
 * That was the shape of the defect this exists to prevent: the filters lived
 * in three server-only places, so a picker built on the raw lists could hand
 * a shop a switched-off category, an empty group or a slug somebody else
 * holds, and the link would look saved and never appear.
 *
 * Beyond `offeredRows` on each list, two rules that only exist ACROSS lists:
 *
 *  - A GROUP WITH NOTHING IN IT is a link to an empty grid. Answered from
 *    `productIds.length`, so no product is read.
 *  - A CATEGORY WHOSE ADDRESS A COLLECTION HAS TAKEN is not offered. Both
 *    live at /store/collections/<slug> and the route resolves COLLECTION
 *    first, so that row would be a link opening somebody else's page under
 *    the category's name.
 *
 * IDEMPOTENT: running it over lists that have already been through it changes
 * nothing, which is what lets the storefront reader and the caller above it
 * both go through the same rule without arguing about who ran it.
 *
 * Deliberately NOT answered here: an empty CATEGORY or OCCASION is still
 * offered. Hiding those needs a count per row, and a count needs the product
 * collection, which is the read the header exists to avoid.
 */
export function offeredAxes<
  C extends { slug?: string; isActive?: boolean; sortOrder?: number },
  O extends { slug?: string; isActive?: boolean; sortOrder?: number },
  L extends { slug?: string; isActive?: boolean; sortOrder?: number; productIds?: string[] },
  D extends { slug?: string; isActive?: boolean; sortOrder?: number; categoryIds?: string[] } = {
    slug?: string;
    isActive?: boolean;
    sortOrder?: number;
    categoryIds?: string[];
  },
>(input: {
  categories: readonly C[];
  occasions: readonly O[];
  collections: readonly L[];
  /*
    OPTIONAL, so every existing caller keeps compiling and keeps behaving.
    A shop with no departments is exactly where this one is today.
  */
  departments?: readonly D[];
}): { categories: C[]; occasions: O[]; collections: L[]; departments: D[] } {
  const collections = offeredRows(input.collections).filter(
    (row) => (row.productIds ?? []).length > 0,
  );
  const claimed = new Set(collections.map((row) => row.slug).filter(Boolean));

  return {
    categories: offeredRows(input.categories).filter((row) => !claimed.has(row.slug)),
    occasions: offeredRows(input.occasions),
    collections,
    /*
      A DEPARTMENT WITH NOTHING FILED UNDER IT IS NOT OFFERED — the same rule
      as the empty collection above, and answered the same way, from ids
      already in hand rather than by reading a single product.
    */
    departments: offeredRows(input.departments ?? []).filter(
      (row) => (row.categoryIds ?? []).length > 0,
    ),
  };
}

/**
 * WHICH DEPARTMENT A CATEGORY SITS UNDER, when the shop has said.
 *
 * A category may be filed under more than one — Roses under Flowers and under
 * Gifts — and that is the whole reason membership lives on the department
 * rather than as a parent pointer. So this has to CHOOSE, and the choice must
 * be the shop's rather than ours.
 *
 * It is the first department in the shop's own order that holds this category.
 * `offeredRows` sorts by `sortOrder` BEFORE it dedupes, so "first" means the
 * one the shop put first, not the one it happened to create first — and
 * re-ordering the Departments tab changes the answer, which is the only
 * control over it a shop should need.
 *
 * `undefined` when nothing holds it, which is every category today. A trail
 * with no department in it is the trail as it was.
 */
export function departmentFor<
  D extends { slug?: string; isActive?: boolean; sortOrder?: number; categoryIds?: string[] },
>(departments: readonly D[], categoryId: string | undefined): D | undefined {
  if (!categoryId) return undefined;
  return offeredRows(departments).find(
    (row) => (row.categoryIds ?? []).includes(categoryId) && (row.categoryIds ?? []).length > 0,
  );
}

/**
 * THE CATEGORY LIST, CUT INTO THE KINDS OF THING THE SHOP SELLS.
 *
 * A shop selling cakes and flowers and gifts has one category list with all
 * three kinds of thing in it, and a menu that draws it flat reads as one long
 * alphabet: Anniversary, Bouquets, Chocolate, Cupcakes, Roses. The customer
 * cannot see where cakes stop and flowers start.
 *
 * So the column is SECTIONED, and the section headings are the shop's own
 * departments. The panel stays three columns wide — this adds sub-headings
 * inside the first column, not a fourth column, which is why no width map
 * changes with it.
 *
 * TWO RULES DECIDE THE RESULT, and both matter more than they look:
 *
 *   - A SHOP WITH NO DEPARTMENTS GETS ONE UNHEADED SECTION holding everything,
 *     which draws as the same flat list. Every shop is in that
 *     state on the day this ships, including this one, so the no-department
 *     answer is the one that must not move.
 *
 *   - WHICH DEPARTMENT A CATEGORY BELONGS TO IS ASKED THROUGH `departmentFor`
 *     and not decided again here. A category claimed by two departments
 *     appears once, under the first in the shop's order.
 *
 *     THE POINT OF ROUTING IT THERE is that the storefront will have to name a
 *     category's department in more than one place — the trail above a product
 *     is the next one — and two rules would let the menu file Roses under
 *     Flowers while the trail said Gifts, each looking right in its own file.
 *     As of this writing NOTHING ELSE CALLS IT: the trail names no department
 *     yet, so this is the first caller and not the second. That is the reason
 *     to route through it now rather than after there are two answers to
 *     reconcile.
 *
 * Anything no department claims comes LAST in an unheaded section, rather than
 * being dropped: a shop mid-way through filing its catalogue would otherwise
 * watch categories vanish from its own menu as it created the first department.
 *
 * AND THAT LAST SECTION IS HOW THE NO-DEPARTMENT ANSWER IS PRODUCED — there is
 * no separate early return for it, and two were deleted from here. With no
 * department to claim anything, everything is unclaimed, so the leftover
 * section IS the flat list, in the order it arrived. The early returns computed
 * the same array by a second route, which meant the case every shop is in ran
 * through code no other case touched and no mutation could tell apart.
 */
export function categorySections<
  C extends { id: string },
  D extends { name: string; slug?: string; isActive?: boolean; sortOrder?: number; categoryIds?: string[] },
>(
  categories: readonly C[],
  departments: readonly D[] | undefined,
): { heading: string; categories: C[] }[] {
  const rows = offeredRows(departments ?? []);

  const filed = new Map<string, C[]>();
  const loose: C[] = [];
  for (const category of categories) {
    const owner = departmentFor(rows, category.id);
    if (!owner) {
      loose.push(category);
      continue;
    }
    const held = filed.get(owner.name);
    if (held) held.push(category);
    else filed.set(owner.name, [category]);
  }

  const sections = rows
    .map((row) => ({ heading: row.name, categories: filed.get(row.name) ?? [] }))
    .filter((section) => section.categories.length > 0);
  if (loose.length > 0) sections.push({ heading: "", categories: loose });
  return sections;
}
