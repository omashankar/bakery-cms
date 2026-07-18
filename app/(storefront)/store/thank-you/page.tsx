import type { Metadata } from "next";
import { ThankYouPage } from "@/apps/website";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata("store-thank-you");

export default function Page() {
  return <ThankYouPage />;
}
