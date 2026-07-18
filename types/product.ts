import type { BaseEntity, EntityStatus, SeoFields } from "./common";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export type ProductVariantGroupType = "egg" | "photo" | "custom";

/**
 * Machine-readable meaning of a variant option.
 *
 * Business logic must branch on this, never on `label`. Labels are display text:
 * merchants rename them ("No egg"), translate them ("अंडा रहित"), and word them
 * for their own storefront. A label is for humans; a semantic is for code.
 *
 * The mechanism is generic — a flower shop would define its own semantics and
 * leave these unused. Only the values below are bakery-specific.
 */
export type VariantOptionSemantic = "eggless" | "photo-print";

export interface ProductVariantOption {
  id: string;
  label: string;
  /** Optional: absent means the option carries no special meaning (e.g. "Regular"). */
  semantic?: VariantOptionSemantic;
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

export interface ProductDetails {
  barcode?: string;
  preparationTimeMinutes?: number;
  shelfLifeDays?: number;
  calories?: number;
  allergens?: string;
  careInstructions?: string;
}

export interface Product extends BaseEntity, ProductDetails {
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
  weights: ProductWeight[];
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

export interface ProductWeight {
  label: string;
  price: number;
  serves?: string;
}

export interface ProductCategory extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  cakeCount?: number;
}

export interface ProductFlavour extends BaseEntity {
  name: string;
  slug: string;
}

export interface ProductOccasion extends BaseEntity {
  name: string;
  slug: string;
}

export type ProductFormData = Omit<Product, "id" | "createdAt" | "updatedAt">;
