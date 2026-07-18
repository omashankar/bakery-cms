import type { Metadata } from "next";
import { ProductPreviewPage } from "@/features/admin/products";

export const metadata: Metadata = {
  title: "Preview Cake",
  description: "Preview cake before publishing.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <ProductPreviewPage cakeId={id} />;
}
