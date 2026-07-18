import type { Metadata } from "next";
import { PrivacyPage } from "@/features/storefront";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata("store-privacy");

export default function Page() {
  return <PrivacyPage />;
}
