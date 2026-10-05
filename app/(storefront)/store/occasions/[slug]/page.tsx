import type { Metadata } from "next";

import { CollectionsPage } from "@/apps/website/pages/collections-page";
import { getStorefrontProductCards } from "@/features/products/data/products-service";
import {
  getStorefrontCategories,
  getStorefrontOccasions,
} from "@/apps/website/lib/storefront-categories.server";
import { getServerLabels } from "@/features/settings/server/labels.server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * AN OCCASION'S OWN PAGE.
 *
 * Occasions have always been a real membership axis — tagged on the product,
 * offered as a filter, and 26 of this shop's 29 products carry one — but they
 * had no address of their own. They resolved at `/store/collections/<slug>`
 * alongside categories and collections, where the listing ORs a category's
 * products with an occasion's tags. A shop with "Birthday Cakes" as a category
 * AND "Birthday" as an occasion, which this one has along with Wedding and
 * Anniversary, therefore had one page for the two, carrying the category's
 * name.
 *
 * `/store/collections/<slug>` is untouched and still answers exactly as it
 * did. This is a second door.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [{ slug }, occasions, labels] = await Promise.all([
    params,
    getStorefrontOccasions(),
    getServerLabels(),
  ]);

  const occasion = occasions.find((item) => item.slug === slug);

  return {
    title: occasion ? occasion.name : labels.collectionsTitle,
    /*
      An occasion carries no description of its own — the stored row is a name
      and a slug — so this is generated, and says what the page IS rather than
      making a claim about the shop.
    */
    description: occasion
      ? `${labels.productWordPlural} for ${occasion.name.toLowerCase()}.`
      : labels.collectionsSubtitle,
  };
}

export default async function Page({ params }: PageProps) {
  const [{ slug }, catalog, categories, occasions] = await Promise.all([
    params,
    getStorefrontProductCards(),
    getStorefrontCategories(),
    getStorefrontOccasions(),
  ]);

  const occasion = occasions.find((item) => item.slug === slug);

  /*
    An unknown slug falls through to the plain listing rather than 404ing — the
    same thing the collections route does, and for the same reason: these lists
    are shop-edited, so a renamed occasion turns every link to it into a
    mistake, and a full catalogue is a better answer to that than a dead end.
  */
  return (
    <CollectionsPage
      catalog={catalog}
      categories={categories}
      occasion={occasion ? { name: occasion.name, slug: occasion.slug } : undefined}
    />
  );
}
