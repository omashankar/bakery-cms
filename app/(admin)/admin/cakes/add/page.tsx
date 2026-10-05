import type { Metadata } from "next";
import { getServerLabels } from "@/features/settings/server/labels.server";
import { ProductFormPage } from "@/apps/admin/products";

export async function generateMetadata(): Promise<Metadata> {
  const { productWord } = await getServerLabels();
  return {
    title: `Add ${productWord}`,
    description: `Create a new ${productWord.toLowerCase()} with images, SEO, and categories.`,
  };
}

export default function Page() {
  return <ProductFormPage mode="add" />;
}
