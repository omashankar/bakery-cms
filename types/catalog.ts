import type { ProductCategory, ProductFlavour, ProductOccasion } from "./product";

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
  categories: ProductCategory[];
  flavours: ProductFlavour[];
  occasions: ProductOccasion[];
  weights: CatalogWeightOption[];
  updatedAt: string;
}

export type CatalogTab = "categories" | "flavours" | "occasions" | "weights";
