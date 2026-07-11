import type { Metadata } from "next";
import { TermsPage } from "@/features/storefront";
import { buildRouteMetadata } from "@/features/admin/seo";

export const metadata: Metadata = buildRouteMetadata("store-terms");

export default function Page() {
  return <TermsPage />;
}
