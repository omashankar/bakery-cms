import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutPaymentFailedPage } from "@/features/storefront/checkout/pages/checkout-payment-failed-page";

export const metadata: Metadata = {
  title: "Payment Failed",
  description: "Your payment could not be processed.",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <CheckoutPaymentFailedPage />
    </Suspense>
  );
}
