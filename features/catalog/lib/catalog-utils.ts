import { categories } from "@/constants/landing-data";
import type {
  ProductCategory,
  ProductFlavour,
  ProductOccasion,
  ProductWeight,
} from "@/types/product";
import type { CatalogStore, CatalogWeightOption } from "@/types/catalog";

function nowIso(): string {
  return new Date().toISOString();
}

export const defaultWeightOptions: CatalogWeightOption[] = [
  {
    id: "wt-05",
    label: "0.5 kg",
    modifier: 0,
    serves: "4–6",
    sortOrder: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: "wt-1",
    label: "1 kg",
    modifier: 200,
    serves: "8–10",
    sortOrder: 2,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: "wt-15",
    label: "1.5 kg",
    modifier: 450,
    serves: "12–15",
    sortOrder: 3,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

export const defaultCategories: ProductCategory[] = [
  ...categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    image: category.image,
    cakeCount: category.count,
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

export const defaultFlavours: ProductFlavour[] = [
  { id: "fl-chocolate", name: "Chocolate", slug: "chocolate", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "fl-vanilla", name: "Vanilla", slug: "vanilla", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "fl-fruit", name: "Fruit", slug: "fruit", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "fl-butterscotch", name: "Butterscotch", slug: "butterscotch", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "fl-red-velvet", name: "Red Velvet", slug: "red-velvet", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "fl-pistachio", name: "Pistachio", slug: "pistachio", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

export const defaultOccasions: ProductOccasion[] = [
  { id: "oc-birthday", name: "Birthday", slug: "birthday", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "oc-wedding", name: "Wedding", slug: "wedding", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "oc-anniversary", name: "Anniversary", slug: "anniversary", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "oc-corporate", name: "Corporate", slug: "corporate", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

export const defaultCatalogStore: CatalogStore = {
  categories: defaultCategories,
  flavours: defaultFlavours,
  occasions: defaultOccasions,
  weights: defaultWeightOptions,
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

export function weightsToProductWeights(
  basePrice: number,
  weights: CatalogWeightOption[]
): ProductWeight[] {
  return [...weights]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((option) => ({
      label: option.label,
      price: basePrice + option.modifier,
      serves: option.serves,
    }));
}
