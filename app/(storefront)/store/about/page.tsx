import type { Metadata } from "next";
import { AboutPage } from "@/apps/website";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata("store-about");

interface PageProps {
  searchParams: Promise<{ preview?: string }>;
}

export default async function Page(props: PageProps) {
  const { preview } = await props.searchParams;
  return <AboutPage preview={preview === "1"} />;
}
