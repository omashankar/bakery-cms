import type { Metadata } from "next";
import { StoreHomePage } from "@/features/storefront";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata("store-home");

export default function Page() {
  return <StoreHomePage />;
}
