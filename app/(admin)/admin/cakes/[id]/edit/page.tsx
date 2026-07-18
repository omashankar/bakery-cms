import type { Metadata } from "next";
import { ProductFormPage } from "@/features/admin/products";

export const metadata: Metadata = {
  title: "Edit Cake",
  description: "Edit existing cake details.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <ProductFormPage mode="edit" cakeId={id} />;
}
