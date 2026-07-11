import { demoPhotoIds, unsplash } from "@/constants/demo-images";
import type { LandingCake } from "@/constants/landing-data";
import { getFlavours } from "@/features/admin/catalog/lib/catalog-repository";
import { getCommerceSettings } from "@/features/admin/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/admin/settings/lib/settings-utils";
import {
  createDefaultVariantGroups,
  formatPreparationTime,
  formatShelfLife,
} from "@/features/admin/cakes/lib/variant-utils";
import type { ProductVariantGroup } from "@/types/cake";
import {
  getStorefrontReviewsForCake,
} from "@/features/admin/reviews/lib/reviews-repository";

export interface ProductReview {
  id: string;
  author: string;
  rating: number;
  text: string;
  title?: string;
  date: string;
  adminReply?: string;
  repliedAt?: string;
  isFeatured?: boolean;
}

const galleryPool = [
  demoPhotoIds.chocolateCake,
  demoPhotoIds.decoratedCake,
  demoPhotoIds.stackCake,
  demoPhotoIds.cupcakes,
];

export function getCakeGalleryImages(cake: LandingCake): string[] {
  const seed = Number(cake.id.replace(/\D/g, "")) || 1;
  const alternates = galleryPool
    .filter((id) => !cake.image.includes(id))
    .slice(0, 3)
    .map((id, index) => unsplash(id, 800, 800));

  return [cake.image, ...alternates].slice(0, 4);
}

export function getCakeFlavourOptions(cake: LandingCake): string[] {
  if (cake.flavours?.length) return cake.flavours;

  const fromCatalog = getFlavours()
    .slice(0, 4)
    .map((item) => item.name);

  if (fromCatalog.length > 0) return fromCatalog;

  return ["Chocolate", "Vanilla", "Red Velvet", "Butterscotch"];
}

export function getCakeShapeOptions(cake?: LandingCake): string[] {
  if (cake?.shapes?.length) return cake.shapes;
  return ["Round", "Square", "Heart"];
}

export function getCakeVariantGroups(cake: LandingCake): ProductVariantGroup[] {
  if (cake.variantGroups?.length) return cake.variantGroups;

  return createDefaultVariantGroups({
    isEggless: cake.isEggless,
    isPhotoCake:
      cake.allowsPhotoUpload === true || cake.category.toLowerCase().includes("photo"),
  });
}

export function getProductDetailBadges(cake: LandingCake): string[] {
  const badges: string[] = [];
  const prep = formatPreparationTime(cake.preparationTimeMinutes);
  const shelf = formatShelfLife(cake.shelfLifeDays);
  if (prep) badges.push(prep);
  if (shelf) badges.push(shelf);
  if (cake.calories) badges.push(`${cake.calories} kcal / serving`);
  if (cake.barcode) badges.push(`SKU ${cake.barcode}`);
  return badges;
}

export function getDeliveryTimeSlots(): string[] {
  const slots =
    typeof window !== "undefined"
      ? getCommerceSettings().deliveryTimeSlots
      : defaultCommerceSettings.deliveryTimeSlots;
  return slots.filter((slot) => slot.trim().length > 0);
}

export function getCakeReviews(cake: LandingCake): ProductReview[] {
  if (typeof window === "undefined") return [];
  return getStorefrontReviewsForCake(cake.slug);
}

export function getMinDeliveryDate(): string {
  const leadDays =
    typeof window !== "undefined"
      ? getCommerceSettings().deliveryLeadDays
      : defaultCommerceSettings.deliveryLeadDays;
  const date = new Date();
  date.setDate(date.getDate() + Math.max(leadDays, 0));
  return date.toISOString().split("T")[0] ?? "";
}
