import {
  Cake,
  Candy,
  Flower2,
  Gift,
  Laptop,
  Package,
  Pill,
  Shirt,
  ShoppingBasket,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { BusinessType } from "@/types/settings";

/**
 * Central config for product-noun labels that read differently per business type.
 *
 * Scope is intentionally small — public headings/titles plus the singular/plural
 * product noun. Routes, folders, components, and database collections are NEVER
 * renamed from here (that is deliberate — only visible wording changes). Homepage
 * section titles are edited via the Homepage Builder, so they are not repeated.
 *
 * `bakery` keeps the exact wording the app already ships with, so the default
 * template renders byte-for-byte the same as before.
 */
export interface BusinessLabels {
  /** Heading on the storefront collections / shop-all page (no category selected). */
  collectionsTitle: string;
  /** Sub-heading under the collections title. */
  collectionsSubtitle: string;
  /** Singular noun for one catalog item (e.g. "Cake", "Dish", "Bouquet"). */
  productWord: string;
  /** Plural noun for catalog items (e.g. "Cakes", "Flowers", "Products"). */
  productWordPlural: string;
  /** Lucide icon that represents this business's catalog item (sidebar, empty states). */
  productIcon: LucideIcon;
}

const BAKERY_LABELS: BusinessLabels = {
  collectionsTitle: "Our Collections",
  collectionsSubtitle: "Browse premium cakes by category, flavour, and occasion.",
  productWord: "Cake",
  productWordPlural: "Cakes",
  productIcon: Cake,
};

export const BUSINESS_LABELS: Record<BusinessType, BusinessLabels> = {
  bakery: BAKERY_LABELS,
  "sweet-shop": {
    collectionsTitle: "Our Sweets",
    collectionsSubtitle: "Browse our sweets and confections by category and occasion.",
    productWord: "Sweet",
    productWordPlural: "Sweets",
    productIcon: Candy,
  },
  "flower-shop": {
    collectionsTitle: "Our Flowers",
    collectionsSubtitle: "Browse fresh flowers and arrangements by category and occasion.",
    productWord: "Bouquet",
    productWordPlural: "Flowers",
    productIcon: Flower2,
  },
  restaurant: {
    collectionsTitle: "Our Menu",
    collectionsSubtitle: "Browse our menu by category.",
    productWord: "Dish",
    productWordPlural: "Dishes",
    productIcon: UtensilsCrossed,
  },
  "gift-shop": {
    collectionsTitle: "Our Gifts",
    collectionsSubtitle: "Browse gifts by category and occasion.",
    productWord: "Gift",
    productWordPlural: "Gifts",
    productIcon: Gift,
  },
  grocery: {
    collectionsTitle: "Our Products",
    collectionsSubtitle: "Browse groceries and essentials by category.",
    productWord: "Product",
    productWordPlural: "Products",
    productIcon: ShoppingBasket,
  },
  fashion: {
    collectionsTitle: "Our Collection",
    collectionsSubtitle: "Browse the latest styles by category.",
    productWord: "Product",
    productWordPlural: "Products",
    productIcon: Shirt,
  },
  electronics: {
    collectionsTitle: "Our Products",
    collectionsSubtitle: "Browse electronics and gadgets by category.",
    productWord: "Product",
    productWordPlural: "Products",
    productIcon: Laptop,
  },
  pharmacy: {
    collectionsTitle: "Our Products",
    collectionsSubtitle: "Browse health and wellness products by category.",
    productWord: "Product",
    productWordPlural: "Products",
    productIcon: Pill,
  },
  other: {
    collectionsTitle: "Our Products",
    collectionsSubtitle: "Browse our products by category.",
    productWord: "Product",
    productWordPlural: "Products",
    productIcon: Package,
  },
};

/** Resolve labels for a business type, falling back to the bakery defaults. */
export function getBusinessLabels(type: BusinessType): BusinessLabels {
  return BUSINESS_LABELS[type] ?? BAKERY_LABELS;
}
