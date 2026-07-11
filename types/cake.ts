import type { BaseEntity, EntityStatus, SeoFields } from "./common";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export type ProductVariantGroupType = "egg" | "photo" | "custom";

export interface ProductVariantOption {
  id: string;
  label: string;
  priceAdjustment: number;
  isDefault?: boolean;
}

export interface ProductVariantGroup {
  id: string;
  name: string;
  type: ProductVariantGroupType;
  required: boolean;
  options: ProductVariantOption[];
}

export interface CakeProductDetails {
  barcode?: string;
  preparationTimeMinutes?: number;
  shelfLifeDays?: number;
  calories?: number;
  allergens?: string;
  careInstructions?: string;
}

export interface Cake extends BaseEntity, CakeProductDetails {
  name: string;
  slug: string;
  description: string;
  shortDescription?: string;
  price: number;
  compareAtPrice?: number;
  images: string[];
  categoryId: string;
  flavourId?: string;
  occasionIds: string[];
  weights: CakeWeight[];
  status: EntityStatus;
  isFeatured: boolean;
  isBestSeller: boolean;
  isTrending: boolean;
  isEggless: boolean;
  isPhotoCake: boolean;
  isSeasonal: boolean;
  shapes: string[];
  flavourOptions: string[];
  stockStatus: StockStatus;
  stockQuantity: number;
  unlimitedStock: boolean;
  lowStockThreshold?: number;
  allowsMessage: boolean;
  allowsPhotoUpload: boolean;
  ingredients?: string;
  variantGroups: ProductVariantGroup[];
  rating: number;
  reviewCount: number;
  seo: SeoFields;
}

export interface CakeWeight {
  label: string;
  price: number;
  serves?: string;
}

export interface CakeCategory extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  cakeCount?: number;
}

export interface CakeFlavour extends BaseEntity {
  name: string;
  slug: string;
}

export interface CakeOccasion extends BaseEntity {
  name: string;
  slug: string;
}

export type CakeFormData = Omit<Cake, "id" | "createdAt" | "updatedAt">;
