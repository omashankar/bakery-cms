import type { Metadata } from "next";
import { CollectionsPage } from "@/apps/website/pages/collections-page";
import { getStorefrontProductCards } from "@/features/products/data/products-service";
import {
  getStorefrontCategories,
  getStorefrontCollections,
} from "@/apps/website/lib/storefront-categories.server";
import { getServerLabels } from "@/features/settings/server/labels.server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [{ slug }, categories, collections, labels] = await Promise.all([
    params,
    getStorefrontCategories(),
    getStorefrontCollections(),
    getServerLabels(),
  ]);
  /**
   * COLLECTIONS FIRST, then categories — the same order the page itself
   * resolves in, or the title and the grid would describe different things.
   *
   * The two share one address space: a slug resolves against categories OR
   * occasions OR collections, and nothing stopped them colliding until the
   * admin's slug check started reading all three lists. A collection wins
   * because it is the one a person deliberately created at that address.
   */
  const collection = collections.find((item) => item.slug === slug);
  // The SHOP's categories, not the shipped demo list — a category the shop
  // added used to get the generic "Collection" in its <title> and a renamed one
  // kept the old name there long after the page itself had changed.
  const category = categories.find((item) => item.slug === slug);
  const named = collection ?? category;

  return {
    title: named ? named.name : "Collection",
    // “our bakery store” and “cake collections”, on the page whose whole job is
    // to be the shop’s own catalogue. The shop’s subtitle is a configured field.
    description:
      // The owner's own pitch when they wrote one — it is the sentence that
      // gets shared, and a generated "Shop diwali gifts at …" replaces it with
      // something nobody chose.
      collection?.description?.trim() ||
      (named
        ? `Shop ${named.name.toLowerCase()} at ${labels.collectionsTitle.toLowerCase()}.`
        : labels.collectionsSubtitle),
  };
}

export default async function Page({ params }: PageProps) {
  const [{ slug }, catalog, categories, collections] = await Promise.all([
    params,
    getStorefrontProductCards(),
    getStorefrontCategories(),
    getStorefrontCollections(),
  ]);

  // Resolved here rather than in the page, so the client component receives a
  // decision rather than three lists and the rule for choosing between them.
  const collection = collections.find((item) => item.slug === slug);

  return (
    <CollectionsPage
      categorySlug={slug}
      catalog={catalog}
      categories={categories}
      collection={
        collection
          ? {
              name: collection.name,
              description: collection.description,
              productIds: collection.productIds,
            }
          : undefined
      }
    />
  );
}
