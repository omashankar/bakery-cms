/** Catalog options — reads from catalog repository */
import type { ProductWeight } from "@/types/product";
import {
  getCategories,
  getFlavours,
  getOccasions,
  getCategoryById,
  getCategoryByName,
  getFlavourByName,
  getWeightOptions,
} from "@/features/catalog/lib/catalog-repository";
import { weightsToProductWeights } from "@/features/catalog/lib/catalog-utils";

export const adminCategories = getCategories;
export const adminFlavours = getFlavours;
export const adminOccasions = getOccasions;

export function getDefaultWeights(basePrice: number): ProductWeight[] {
  return weightsToProductWeights(basePrice, getWeightOptions());
}

export { getCategoryById, getCategoryByName, getFlavourByName };
