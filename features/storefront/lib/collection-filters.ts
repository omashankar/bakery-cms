import type { LandingProduct } from "@/constants/landing-data";
import { getFlavours, getOccasions } from "@/features/catalog/lib/catalog-repository";

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

export function getFilterWeightOptions(): string[] {
  return ["0.5 kg", "1 kg", "1.5 kg"];
}

function matchesOccasion(cake: LandingProduct, occasions: string[]): boolean {
  if (occasions.length === 0) return true;
  const haystack = `${cake.name} ${cake.category} ${cake.description}`.toLowerCase();
  return occasions.some((occasion) => haystack.includes(occasion.toLowerCase()));
}

function matchesFlavour(cake: LandingProduct, flavours: string[]): boolean {
  if (flavours.length === 0) return true;
  const productFlavours = cake.flavours ?? [];
  const haystack = `${cake.name} ${cake.description} ${productFlavours.join(" ")}`.toLowerCase();
  return flavours.some((flavour) => haystack.includes(flavour.toLowerCase()));
}

function matchesWeight(cake: LandingProduct, weights: string[]): boolean {
  if (weights.length === 0) return true;
  if (weights.includes("1.5 kg") && cake.price >= 1400) return true;
  if (weights.includes("1 kg") && cake.price >= 900 && cake.price < 1600) return true;
  if (weights.includes("0.5 kg") && cake.price < 1100) return true;
  return false;
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
