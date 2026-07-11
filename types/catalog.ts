import type { CakeCategory, CakeFlavour, CakeOccasion } from "./cake";

export interface CatalogWeightOption {
  id: string;
  label: string;
  modifier: number;
  serves: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogStore {
  categories: CakeCategory[];
  flavours: CakeFlavour[];
  occasions: CakeOccasion[];
  weights: CatalogWeightOption[];
  updatedAt: string;
}

export type CatalogTab = "categories" | "flavours" | "occasions" | "weights";
