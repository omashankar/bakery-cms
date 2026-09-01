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
  /**
   * LEGACY, and inert. Nothing reads it.
   *
   * Its only reader was the admin checkbox that wrote it. No picker blocks on
   * it, and `calculateVariantAdjustment` substitutes the group's default option
   * whenever a selection is absent — so a group marked required was priced and
   * recorded exactly like one that was not, and the merchant was told a
   * purchase would be stopped without a choice that it never stopped.
   *
   * Optional rather than deleted, and for the same reason
   * `PaymentMethodSettings.upi/card` were kept: every stored product, and every
   * backup an owner has taken, already carries it. Optional so a caller that
   * has no opinion — an import, an API client — is not forced to invent one.
   * Do not gate anything on it without making it mean something first.
   */
  required?: boolean;
  options: ProductVariantOption[];
}

/**
 * A fact about the product, in the merchant's own words.
 *
 * Brand: Samsung. Material: Ceramic. Warranty: 1 year. RAM: 8 GB. Not a choice
 * the customer makes and not a price — which is exactly what separates it from
 * `ProductVariantOption`, and why abusing a one-option variant group for it is
 * wrong: the product page renders every group as a row of clickable buttons, so
 * "Brand: Samsung" would read as something to pick, and `formatVariantSummary`
 * would fold it into `variantSummary` and stamp it on the order line as though
 * the customer had chosen it.
 *
 * Deliberately NOT part of `ProductDetails`. Those six are typed food scalars
 * that four formatters consume as numbers — `${calories} kcal / serving`,
 * shelf-life in days — and turning them into label/value strings would make all
 * of that string parsing. They stay; this sits beside them.
 *
 * Optional, because `mapLandingProductToAdmin` builds a whole `Product` literal
 * for the seed and a required field would break it.
 */
export interface ProductAttribute {
  id: string;
  label: string;
  value: string;
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
  /** Owner-defined facts. See ProductAttribute — never a choice, never priced. */
  attributes?: ProductAttribute[];
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
