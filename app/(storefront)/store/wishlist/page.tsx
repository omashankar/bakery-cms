import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getServerLabels } from "@/features/settings/server/labels.server";
import { getStorefrontProductCards } from "@/features/products/data/products-service";
import { WishlistPage } from "@/apps/website/pages/wishlist-page";
import { WISHLIST_COOKIE, wishlistFromCookie } from "@/apps/website/lib/wishlist-cookie";

export async function generateMetadata(): Promise<Metadata> {
  const { productWordPlural } = await getServerLabels();
  return {
    title: "Wishlist",
    description: `Your saved ${productWordPlural.toLowerCase()}.`,
  };
}

export default async function Page() {
  const [catalog, jar] = await Promise.all([getStorefrontProductCards(), cookies()]);
  // What this browser had saved when it last changed, so the page is drawn
  // with it — the cards, or the empty line — instead of a skeleton that waited
  // for the scripts (see wishlist-cookie.ts).
  const { slugs, known } = wishlistFromCookie(jar.get(WISHLIST_COOKIE)?.value);

  return <WishlistPage catalog={catalog} initialSlugs={slugs} initialKnown={known} />;
}
