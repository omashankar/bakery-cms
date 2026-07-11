import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutPaymentPage } from "@/features/storefront/checkout/pages/checkout-payment-page";

export const metadata: Metadata = {
  title: "Payment",
  description: "Complete payment for your bakery order.",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <CheckoutPaymentPage />
    </Suspense>
  );
}
