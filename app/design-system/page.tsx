import type { Metadata } from "next";
import { DesignSystemPage } from "@/features/design-system/design-system-page";
import { PRODUCT_METADATA } from "@/constants/product-brand";

export const metadata: Metadata = {
  // ABSOLUTE, not "Design System". A plain string re-enters the root layout's
  // `%s | <shop name>` template, which is how the vendor's own component gallery
  // came to be titled after a client bakery.
  title: { absolute: "Design System — Bakery CMS" },
  description: "Bakery CMS design tokens, components, and UI foundations.",
  ...PRODUCT_METADATA,
  /**
   * Never indexed.
   *
   * This page is public and unauthenticated, and it is the vendor's, not the
   * shop's — so on a shop's own domain it is a page about somebody else's
   * software, carrying sample data. It stayed out of Google only because the
   * shop's SEO store happens to have indexing switched off site-wide; the day a
   * shop turns that on, this would have gone in with it.
   */
  robots: { index: false, follow: false },
};

export default function Page() {
  return <DesignSystemPage />;
}
