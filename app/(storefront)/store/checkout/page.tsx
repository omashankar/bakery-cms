import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutPage } from "@/features/storefront/checkout/pages/checkout-page";
import { getStorefrontProductCards } from "@/features/products/data/products-service";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your bakery order checkout.",
};

export default async function Page() {
  // The live published catalogue, so checkout can re-check the cart against it.
  const catalog = await getStorefrontProductCards();

  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <CheckoutPage catalog={catalog} />
    </Suspense>
  );
}
