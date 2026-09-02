import type { Metadata } from "next";
import { CollectionsPage } from "@/apps/website/pages/collections-page";
import { getStorefrontProductCards } from "@/features/products/data/products-service";
import { getStorefrontCategories } from "@/apps/website/lib/storefront-categories.server";
import { getServerLabels } from "@/features/settings/server/labels.server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [{ slug }, categories, labels] = await Promise.all([
    params,
    getStorefrontCategories(),
    getServerLabels(),
  ]);
  // The SHOP's categories, not the shipped demo list — a category the shop
  // added used to get the generic "Collection" in its <title> and a renamed one
  // kept the old name there long after the page itself had changed.
  const category = categories.find((item) => item.slug === slug);
  return {
    title: category ? category.name : "Collection",
    // “our bakery store” and “cake collections”, on the page whose whole job is
    // to be the shop’s own catalogue. The shop’s subtitle is a configured field.
    description: category
      ? `Shop ${category.name.toLowerCase()} at ${labels.collectionsTitle.toLowerCase()}.`
      : labels.collectionsSubtitle,
  };
}

export default async function Page({ params }: PageProps) {
  const [{ slug }, catalog, categories] = await Promise.all([
    params,
    getStorefrontProductCards(),
    getStorefrontCategories(),
  ]);
  return <CollectionsPage categorySlug={slug} catalog={catalog} categories={categories} />;
}
