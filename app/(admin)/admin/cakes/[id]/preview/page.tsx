import type { Metadata } from "next";
import { CakePreviewPage } from "@/features/admin/cakes";

export const metadata: Metadata = {
  title: "Preview Cake",
  description: "Preview cake before publishing.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <CakePreviewPage cakeId={id} />;
}
