import type { Metadata } from "next";
import { PrivacyPage } from "@/features/storefront";
import { buildRouteMetadata } from "@/features/admin/seo";

export const metadata: Metadata = buildRouteMetadata("store-privacy");

export default function Page() {
  return <PrivacyPage />;
}
