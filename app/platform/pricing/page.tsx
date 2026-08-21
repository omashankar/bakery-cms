import type { Metadata } from "next";
import { PricingPage } from "@/features/marketing/pricing-page";

export const metadata: Metadata = {
  title: { absolute: "Pricing — Bakery CMS" },
  description:
    "Plans for a single shop, a growing bakery, or several outlets. Every plan is the whole product; what changes is how much of it you sell.",
  alternates: { canonical: "/platform/pricing" },
};

export default function Page() {
  return <PricingPage />;
}
