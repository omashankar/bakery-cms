import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutPage } from "@/features/storefront/checkout/pages/checkout-page";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your bakery order checkout.",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <CheckoutPage />
    </Suspense>
  );
}
