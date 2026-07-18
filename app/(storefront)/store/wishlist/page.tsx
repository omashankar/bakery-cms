import type { Metadata } from "next";
import { getStorefrontProductCards } from "@/features/products/data/products-service";
import { WishlistPage } from "@/apps/website/pages/wishlist-page";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Your saved cakes.",
};

export default async function Page() {
  const catalog = await getStorefrontProductCards();

  return <WishlistPage catalog={catalog} />;
}
