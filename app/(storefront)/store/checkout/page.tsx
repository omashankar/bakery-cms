import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutPage } from "@/apps/website/checkout/pages/checkout-page";
import { getStorefrontProductCards } from "@/features/products/data/products-service";
import { getStorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your order checkout.",
};

export default async function Page() {
  // Both on the server, concurrently. The catalogue so checkout can re-check
  // the cart against it, and the shop's name because it heads the Razorpay
  // sheet — reading that in the browser meant reading a cache that seeds to a
  // placeholder, so the payment sheet could name a company the customer had
  // never heard of.
  const [catalog, chrome] = await Promise.all([
    getStorefrontProductCards(),
    getStorefrontChrome(),
  ]);

  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <CheckoutPage catalog={catalog} siteName={chrome.siteName} />
    </Suspense>
  );
}
