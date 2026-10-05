import type { Metadata } from "next";
import { CartPage } from "@/apps/website/pages/cart-page";
import { getStorefrontProductCards } from "@/features/products/data/products-service";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "Review items in your cart.",
};

export default async function Page() {
  // The "recently viewed" rail resolves saved slugs against this. Read on the
  // server because the browser has no catalogue of its own — the admin's
  // product cache is not populated on a customer's device.
  const catalog = await getStorefrontProductCards();
  return <CartPage catalog={catalog} />;
}
