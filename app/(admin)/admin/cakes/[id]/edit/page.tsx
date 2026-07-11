import type { Metadata } from "next";
import { CakeFormPage } from "@/features/admin/cakes";

export const metadata: Metadata = {
  title: "Edit Cake",
  description: "Edit existing cake details.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <CakeFormPage mode="edit" cakeId={id} />;
}
