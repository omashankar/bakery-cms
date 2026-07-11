import { categories } from "@/constants/landing-data";
import type {
  CakeCategory,
  CakeFlavour,
  CakeOccasion,
  CakeWeight,
} from "@/types/cake";
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

export const defaultCategories: CakeCategory[] = [
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
  {
    id: "cat-seasonal",
    name: "Seasonal",
    slug: "seasonal",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

export const defaultFlavours: CakeFlavour[] = [
  { id: "fl-chocolate", name: "Chocolate", slug: "chocolate", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "fl-vanilla", name: "Vanilla", slug: "vanilla", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "fl-fruit", name: "Fruit", slug: "fruit", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "fl-butterscotch", name: "Butterscotch", slug: "butterscotch", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "fl-red-velvet", name: "Red Velvet", slug: "red-velvet", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  { id: "fl-pistachio", name: "Pistachio", slug: "pistachio", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
];

export const defaultOccasions: CakeOccasion[] = [
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

export function weightsToCakeWeights(
  basePrice: number,
  weights: CatalogWeightOption[]
): CakeWeight[] {
  return [...weights]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((option) => ({
      label: option.label,
      price: basePrice + option.modifier,
      serves: option.serves,
    }));
}
