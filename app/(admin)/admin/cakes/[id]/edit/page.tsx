import type { Metadata } from "next";
import { getServerLabels } from "@/features/settings/server/labels.server";
import { ProductFormPage } from "@/apps/admin/products";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const { productWord } = await getServerLabels();
  return {
    title: `Edit ${productWord}`,
    description: `Edit existing ${productWord.toLowerCase()} details.`,
  };
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <ProductFormPage mode="edit" cakeId={id} />;
}
