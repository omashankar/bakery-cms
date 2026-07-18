import type { Metadata } from "next";
import { StoreHomePage } from "@/features/storefront";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata("store-home");

interface PageProps {
  searchParams: Promise<{ cmsPreview?: string }>;
}

export default async function Page(props: PageProps) {
  const { cmsPreview } = await props.searchParams;
  return <StoreHomePage isPreview={cmsPreview === "1"} />;
}
