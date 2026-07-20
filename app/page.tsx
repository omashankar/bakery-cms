import type { Metadata } from "next";
import { LandingPage } from "@/features/marketing/landing-page";

export const metadata: Metadata = {
  title: {
    absolute: "Bakery CMS — Complete Bakery Business Management Platform",
  },
  description:
    "Manage your website, products, orders, inventory, customers, delivery, payments, and marketing from one modern dashboard. The complete bakery business platform.",
};

export default function HomePage() {
  return <LandingPage />;
}
