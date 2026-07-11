import type { Metadata } from "next";
import { FaqPage } from "@/features/storefront";
import { buildRouteMetadata } from "@/features/admin/seo";

export const metadata: Metadata = buildRouteMetadata("store-faq");

export default function Page() {
  return <FaqPage />;
}
