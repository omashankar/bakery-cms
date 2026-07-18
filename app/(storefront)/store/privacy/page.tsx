import type { Metadata } from "next";
import { PrivacyPage } from "@/features/storefront";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata("store-privacy");

interface PageProps {
  searchParams: Promise<{ preview?: string }>;
}

export default async function Page(props: PageProps) {
  const { preview } = await props.searchParams;
  return <PrivacyPage preview={preview === "1"} />;
}
