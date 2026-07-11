import type { Metadata } from "next";
import { AboutPage } from "@/features/storefront";
import { buildRouteMetadata } from "@/features/admin/seo";

export const metadata: Metadata = buildRouteMetadata("store-about");

export default function Page() {
  return <AboutPage />;
}
