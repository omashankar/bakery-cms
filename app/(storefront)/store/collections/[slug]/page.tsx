import type { Metadata } from "next";
import { CollectionsPage } from "@/apps/website/pages/collections-page";
import { categories } from "@/constants/landing-data";
import { getStorefrontProductCards } from "@/features/products/data/products-service";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = categories.find((item) => item.slug === slug);
  return {
    title: category ? category.name : "Collection",
    description: category
      ? `Shop ${category.name.toLowerCase()} at our bakery store.`
      : "Browse our cake collections.",
  };
}

export default async function Page({ params }: PageProps) {
  const [{ slug }, catalog] = await Promise.all([params, getStorefrontProductCards()]);
  return <CollectionsPage categorySlug={slug} catalog={catalog} />;
}
