import type { Metadata } from "next";
import { WeddingPage } from "@/apps/website";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata("store-wedding");

interface PageProps {
  searchParams: Promise<{ cmsPreview?: string }>;
}

export default async function Page(props: PageProps) {
  const { cmsPreview } = await props.searchParams;
  return <WeddingPage isPreview={cmsPreview === "wedding"} />;
}
