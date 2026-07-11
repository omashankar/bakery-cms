import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CakeDetailPage } from "@/features/storefront";
import { getCakeBySlug } from "@/features/storefront/lib/catalog";

export const metadata: Metadata = {
  title: "Cake Details",
  description: "Product details, pricing, and order inquiry.",
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function Page(props: PageProps) {
  const { slug } = await props.params;
  const cake = getCakeBySlug(slug);

  if (!cake) {
    notFound();
  }

  return <CakeDetailPage cake={cake} />;
}
