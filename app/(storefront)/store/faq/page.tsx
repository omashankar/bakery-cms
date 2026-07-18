import type { Metadata } from "next";
import { FaqPage } from "@/apps/website";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata("store-faq");

export default function Page() {
  return <FaqPage />;
}
