import type { Metadata } from "next";
import { CartPage } from "@/apps/website/pages/cart-page";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "Review items in your bakery cart.",
};

export default function Page() {
  return <CartPage />;
}
