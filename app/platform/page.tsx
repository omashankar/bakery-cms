import type { Metadata } from "next";
import { LandingPage } from "@/features/marketing/landing-page";
import { PRODUCT_METADATA } from "@/constants/product-brand";

/**
 * The product's own marketing page — for whoever is deciding whether to RUN this
 * software, not for anyone buying a cake.
 *
 * It used to sit at `/`, which meant a customer arriving from Instagram, a
 * printed card or a search result met an advert for a dashboard instead of the
 * shop. `/` now redirects to `/store` (see next.config.ts), and this route is
 * where the page went rather than being deleted: a shop that resells this CMS
 * still needs somewhere to send a prospect, and that address should not be the
 * one its own customers type.
 */
export const metadata: Metadata = {
  title: {
    absolute: "Bakery CMS — Complete Bakery Business Management Platform",
  },
  description:
    "Manage your website, products, orders, inventory, customers, delivery, payments, and marketing from one modern dashboard. The complete bakery business platform.",
  /**
   * Indexed on purpose, unlike the storefront's private routes: this page exists
   * to be found by someone searching for bakery software. The canonical is set
   * so the copy still reachable at `/` cannot compete with it for the same text.
   */
  alternates: { canonical: "/platform" },
  // The product's icon, not the shop's — see constants/product-brand.ts. Left
  // to inherit, this sales page wore a client bakery's logo in the browser tab.
  ...PRODUCT_METADATA,
};

export default function PlatformPage() {
  return <LandingPage />;
}
