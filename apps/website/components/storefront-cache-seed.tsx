"use client";

import { useLayoutEffect } from "react";

import type { AppSettings } from "@/types/settings";
import type { CatalogStore } from "@/types/catalog";
import type { DeliveryZone } from "@/types/delivery";
import type { Banner } from "@/types/media";
import type { FaqItem, Testimonial } from "@/types/content";
import type { StoredCoupon } from "@/features/commerce/lib/coupons-repository";
import { applyPublicSettings } from "@/features/settings/lib/settings-repository";
import { applyServerCatalog } from "@/components/shared/catalog-server-sync";
import { applyServerCoupons } from "@/features/commerce/lib/coupons-repository";
import { applyServerZones } from "@/features/commerce/lib/delivery-zones-repository";
import { persistServerBanners } from "@/features/content/lib/banners-repository";
import { persistServerTestimonials } from "@/features/content/lib/testimonials-repository";
import { persistServerFaqs } from "@/features/content/lib/faq-repository";
import { bannersLoaded, faqsLoaded, testimonialsLoaded } from "@/features/content/lib/content-api";
import { applyServerCustomer } from "@/apps/website/account/lib/customer-session";
import { markStorefrontSeeded } from "@/lib/storefront-seed-flag";

/** What `getStorefrontCacheSeed` reads on the server for a visitor's page. */
export interface StorefrontCacheSeedData {
  settings: Partial<AppSettings>;
  catalog: Partial<CatalogStore>;
  coupons: StoredCoupon[];
  zones: DeliveryZone[];
  banners: Banner[];
  testimonials: Testimonial[];
  faqs: FaqItem[];
  customer: { email: string; name: string; phone?: string; avatarUrl?: string } | null;
}

/**
 * Fills the storefront's browser caches from what the layout read with the
 * page, instead of the eight requests the root providers made after it.
 *
 * Each write is the one those syncs make with a VISITOR's answer, gates
 * included: coupons and zones settle (a visitor's list is all checkout
 * prices from), content is "loaded" but never "writable" (a public list is
 * not the whole collection), settings merge without opening their gate.
 *
 * A LAYOUT effect: after the first render, so nothing read the cache while
 * hydrating; before every passive effect on the page, so the syncs find the
 * flag set and the checkout's first price comes from the shop's own data.
 */
export function StorefrontCacheSeed({ data }: { data: StorefrontCacheSeedData }) {
  useLayoutEffect(() => {
    applyPublicSettings(data.settings);
    applyServerCatalog(data.catalog);
    applyServerCoupons(data.coupons);
    applyServerZones(data.zones);
    persistServerBanners(data.banners);
    bannersLoaded.markSettled();
    persistServerTestimonials(data.testimonials);
    testimonialsLoaded.markSettled();
    persistServerFaqs(data.faqs);
    faqsLoaded.markSettled();
    applyServerCustomer(data.customer);
    markStorefrontSeeded();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page load
  }, []);
  return null;
}
