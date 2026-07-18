import type { Metadata } from "next";
import { GalleryPage } from "@/features/storefront";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";

export const metadata: Metadata = buildRouteMetadata("store-gallery");

export default function Page() {
  return <GalleryPage />;
}
