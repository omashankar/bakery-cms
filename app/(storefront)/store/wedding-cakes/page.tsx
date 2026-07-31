import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WeddingPage } from "@/apps/website";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";
import { isWeddingEnabledOnServer } from "@/features/settings/server/modules.server";

export const metadata: Metadata = buildRouteMetadata("store-wedding");

interface PageProps {
  searchParams: Promise<{ cmsPreview?: string }>;
}

export default async function Page(props: PageProps) {
  // The Wedding module (and a non-bakery business type) hid every link to this
  // page — the navbar item, the mega menu, the FAQ tab, the homepage section —
  // while the route itself kept serving a working wedding-cakes page to anyone
  // holding the URL: a bookmark, a search result, a link someone shared. And it
  // kept taking wedding enquiries. A disabled page has to stop existing.
  if (!(await isWeddingEnabledOnServer())) notFound();

  const { cmsPreview } = await props.searchParams;
  return <WeddingPage isPreview={cmsPreview === "wedding"} />;
}
