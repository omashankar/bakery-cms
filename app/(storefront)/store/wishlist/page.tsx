import type { Metadata } from "next";
import { WishlistPage } from "@/features/storefront/pages/wishlist-page";

export const metadata: Metadata = {
  title: "Wishlist",
  description: "Your saved cakes.",
};

export default function Page() {
  return <WishlistPage />;
}
