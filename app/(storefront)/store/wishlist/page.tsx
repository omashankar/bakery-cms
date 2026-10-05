import type { Metadata } from "next";
import { getServerLabels } from "@/features/settings/server/labels.server";
import { getStorefrontProductCards } from "@/features/products/data/products-service";
import { WishlistPage } from "@/apps/website/pages/wishlist-page";

export async function generateMetadata(): Promise<Metadata> {
  const { productWordPlural } = await getServerLabels();
  return {
    title: "Wishlist",
    description: `Your saved ${productWordPlural.toLowerCase()}.`,
  };
}

export default async function Page() {
  const catalog = await getStorefrontProductCards();

  return <WishlistPage catalog={catalog} />;
}
