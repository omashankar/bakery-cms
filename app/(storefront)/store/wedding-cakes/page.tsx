import type { Metadata } from "next";
import { WeddingPage } from "@/features/storefront";
import { buildRouteMetadata } from "@/features/admin/seo";

export const metadata: Metadata = buildRouteMetadata("store-wedding");

export default function Page() {
  return <WeddingPage />;
}
