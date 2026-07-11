import type { Metadata } from "next";
import { ThankYouPage } from "@/features/storefront";
import { buildRouteMetadata } from "@/features/admin/seo";

export const metadata: Metadata = buildRouteMetadata("store-thank-you");

export default function Page() {
  return <ThankYouPage />;
}
