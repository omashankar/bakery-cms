import type { Metadata } from "next";
import { GalleryPage } from "@/features/storefront";
import { buildRouteMetadata } from "@/features/admin/seo";

export const metadata: Metadata = buildRouteMetadata("store-gallery");

export default function Page() {
  return <GalleryPage />;
}
