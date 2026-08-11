import type { Metadata } from "next";
import { CollectionsPage } from "@/apps/website/pages/collections-page";
import { getStorefrontProductCards } from "@/features/products/data/products-service";
import { getStorefrontCategories } from "@/apps/website/lib/storefront-categories.server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [{ slug }, categories] = await Promise.all([params, getStorefrontCategories()]);
  // The SHOP's categories, not the shipped demo list — a category the shop
  // added used to get the generic "Collection" in its <title> and a renamed one
  // kept the old name there long after the page itself had changed.
  const category = categories.find((item) => item.slug === slug);
  return {
    title: category ? category.name : "Collection",
    description: category
      ? `Shop ${category.name.toLowerCase()} at our bakery store.`
      : "Browse our cake collections.",
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
