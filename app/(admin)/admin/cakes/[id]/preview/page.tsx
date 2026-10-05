import type { Metadata } from "next";
import { getServerLabels } from "@/features/settings/server/labels.server";
import { ProductPreviewPage } from "@/apps/admin/products";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const { productWord } = await getServerLabels();
  return {
    title: `Preview ${productWord}`,
    description: `Preview ${productWord.toLowerCase()} before publishing.`,
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <ProductPreviewPage cakeId={id} />;
}
