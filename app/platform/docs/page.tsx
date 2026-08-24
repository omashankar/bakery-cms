import type { Metadata } from "next";
import { DocsPage } from "@/features/marketing/docs-page";
import { PRODUCT_METADATA } from "@/constants/product-brand";

export const metadata: Metadata = {
  title: { absolute: "Documentation — Bakery CMS" },
  description:
    "A guide to running your shop from the admin panel: naming it, adding cakes, taking orders, running discounts, and keeping it safe.",
  alternates: { canonical: "/platform/docs" },
  // The product's icon, not the shop's — see constants/product-brand.ts.
  ...PRODUCT_METADATA,
};

export default function Page() {
  return <DocsPage />;
}
