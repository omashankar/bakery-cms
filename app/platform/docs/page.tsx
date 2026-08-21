import type { Metadata } from "next";
import { DocsPage } from "@/features/marketing/docs-page";

export const metadata: Metadata = {
  title: { absolute: "Documentation — Bakery CMS" },
  description:
    "A guide to running your shop from the admin panel: naming it, adding cakes, taking orders, running discounts, and keeping it safe.",
  alternates: { canonical: "/platform/docs" },
};

export default function Page() {
  return <DocsPage />;
}
