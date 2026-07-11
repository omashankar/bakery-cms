import type { Metadata } from "next";
import { CollectionsPage } from "@/features/storefront/pages/collections-page";
import { categories } from "@/constants/landing-data";

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
  const { slug } = await params;
  return <CollectionsPage categorySlug={slug} />;
}
