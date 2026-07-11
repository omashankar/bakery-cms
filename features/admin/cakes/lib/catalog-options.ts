/** Catalog options — reads from catalog repository */
import type { CakeWeight } from "@/types/cake";
import {
  getCategories,
  getFlavours,
  getOccasions,
  getCategoryById,
  getCategoryByName,
  getFlavourByName,
  getWeightOptions,
} from "@/features/admin/catalog/lib/catalog-repository";
import { weightsToCakeWeights } from "@/features/admin/catalog/lib/catalog-utils";

export const adminCategories = getCategories;
export const adminFlavours = getFlavours;
export const adminOccasions = getOccasions;

export function getDefaultWeights(basePrice: number): CakeWeight[] {
  return weightsToCakeWeights(basePrice, getWeightOptions());
}

export { getCategoryById, getCategoryByName, getFlavourByName };
