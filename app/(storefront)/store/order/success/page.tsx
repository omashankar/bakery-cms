import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderSuccessPage } from "@/features/storefront/checkout/pages/order-success-page";

export const metadata: Metadata = {
  title: "Order Confirmed",
  description: "Your bakery order has been placed successfully.",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <OrderSuccessPage />
    </Suspense>
  );
}
