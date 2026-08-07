import type { LandingProduct } from "@/constants/landing-data";
import {
  getFlavours,
  getOccasions,
  getWeightOptions,
} from "@/features/catalog/lib/catalog-repository";
import {
  defaultFlavours,
  defaultOccasions,
  defaultWeightOptions,
} from "@/features/catalog/lib/catalog-utils";

export type CollectionSort = "name" | "price-asc" | "price-desc" | "popular";

export interface CollectionFilters {
  search: string;
  sort: CollectionSort;
  occasions: string[];
  flavours: string[];
  weights: string[];
  priceMin: number;
  priceMax: number;
  egglessOnly: boolean;
  inStockOnly: boolean;
}

export const DEFAULT_COLLECTION_FILTERS: CollectionFilters = {
  search: "",
  sort: "popular",
  occasions: [],
  flavours: [],
  weights: [],
  priceMin: 0,
  priceMax: 5000,
  egglessOnly: false,
  inStockOnly: false,
};

export const COLLECTION_PRICE_MAX = 5000;

export function getFilterOccasionOptions(): string[] {
  return getOccasions().map((item) => item.name);
}

export function getFilterFlavourOptions(): string[] {
  return getFlavours().map((item) => item.name);
}

/**
 * The weight tiers this shop actually sells.
 *
 * This was the hard-coded list `["0.5 kg", "1 kg", "1.5 kg"]`, so a shop that
 * added a 2 kg tier — or renamed its tiers, or removed one — had a filter panel
 * offering sizes it does not sell and hiding the ones it does. The Catalog
 * screen's whole Weights tab reached this list not at all.
 */
export function getFilterWeightOptions(): string[] {
  const options = getWeightOptions().map((option) => option.label);
  return options.length > 0 ? options : DEFAULT_FILTER_WEIGHT_OPTIONS;
}

/** Stable for SSR and the first client paint, like the occasion/flavour ones. */
export const DEFAULT_FILTER_WEIGHT_OPTIONS: string[] = defaultWeightOptions.map(
  (option) => option.label
);

/**
 * Stable occasion / flavour defaults for SSR and the client's first paint —
 * identical on server and client, so the filter panel hydrates without a
 * mismatch. The panel swaps in the (possibly customized) catalog values from
 * localStorage after mount.
 */
export const DEFAULT_FILTER_OCCASION_OPTIONS: string[] = defaultOccasions.map((item) => item.name);
export const DEFAULT_FILTER_FLAVOUR_OPTIONS: string[] = defaultFlavours.map((item) => item.name);

/**
 * Match the occasions the cake is TAGGED with.
 *
 * This searched the name, category and description for the occasion word, so
 * the Occasions checkboxes on the product form reached nobody: a cake tagged
 * Wedding was missed unless its prose happened to say "wedding", and a
 * birthday cake whose description mentioned "perfect after a wedding" was
 * offered under Wedding.
 *
 * Untagged products fall back to the old text search rather than vanishing —
 * the shipped demo catalogue carries no occasion ids.
 */
function matchesOccasion(cake: LandingProduct, occasions: string[]): boolean {
  if (occasions.length === 0) return true;

  const tagged = cake.occasions ?? [];
  if (tagged.length > 0) {
    const owned = new Set(tagged.map((name) => name.toLowerCase()));
    return occasions.some((occasion) => owned.has(occasion.toLowerCase()));
  }

  const haystack = `${cake.name} ${cake.category} ${cake.description}`.toLowerCase();
  return occasions.some((occasion) => haystack.includes(occasion.toLowerCase()));
}

function matchesFlavour(cake: LandingProduct, flavours: string[]): boolean {
  if (flavours.length === 0) return true;
  const productFlavours = cake.flavours ?? [];
  const haystack = `${cake.name} ${cake.description} ${productFlavours.join(" ")}`.toLowerCase();
  return flavours.some((flavour) => haystack.includes(flavour.toLowerCase()));
}

/**
 * Match the weight tiers the cake is actually SOLD in.
 *
 * This filtered on price bands — "1.5 kg" meant "costs at least 1400" — which
 * has nothing to do with weight. An expensive small cake was offered under
 * 1.5 kg and a cheap large one was hidden from it, and the bands only knew the
 * three hard-coded labels, so any tier a shop added matched nothing at all.
 *
 * Products with no tiers keep matching, so a shop selling single-size cakes
 * does not disappear the moment a customer touches the filter.
 */
function matchesWeight(cake: LandingProduct, weights: string[]): boolean {
  if (weights.length === 0) return true;

  const tiers = cake.weights ?? [];
  if (tiers.length === 0) return true;

  const owned = new Set(tiers.map((tier) => tier.label.trim().toLowerCase()));
  return weights.some((weight) => owned.has(weight.trim().toLowerCase()));
}

export function applyCollectionFilters(
  cakes: LandingProduct[],
  filters: CollectionFilters
): LandingProduct[] {
  const query = filters.search.trim().toLowerCase();

  let result = cakes.filter((cake) => {
    if (query) {
      const matchesSearch =
        cake.name.toLowerCase().includes(query) ||
        cake.category.toLowerCase().includes(query) ||
        cake.description.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    if (cake.price < filters.priceMin || cake.price > filters.priceMax) return false;
    if (filters.egglessOnly && !cake.isEggless && !cake.category.toLowerCase().includes("eggless")) {
      return false;
    }
    if (filters.inStockOnly && cake.inStock === false) return false;

    return (
      matchesOccasion(cake, filters.occasions) &&
      matchesFlavour(cake, filters.flavours) &&
      matchesWeight(cake, filters.weights)
    );
  });

  result = [...result].sort((a, b) => {
    if (filters.sort === "price-asc") return a.price - b.price;
    if (filters.sort === "price-desc") return b.price - a.price;
    if (filters.sort === "popular") return (b.rating ?? 0) - (a.rating ?? 0);
    return a.name.localeCompare(b.name);
  });

  return result;
}

export function countActiveFilters(filters: CollectionFilters): number {
  let count = 0;
  if (filters.occasions.length) count += 1;
  if (filters.flavours.length) count += 1;
  if (filters.weights.length) count += 1;
  if (filters.egglessOnly) count += 1;
  if (filters.inStockOnly) count += 1;
  if (filters.priceMin > 0 || filters.priceMax < COLLECTION_PRICE_MAX) count += 1;
  return count;
}
