import type { Metadata } from "next";
import { TermsPage } from "@/apps/website";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata("store-terms");

interface PageProps {
  searchParams: Promise<{ preview?: string }>;
}

export default async function Page(props: PageProps) {
  const { preview } = await props.searchParams;
  return <TermsPage preview={preview === "1"} />;
}
