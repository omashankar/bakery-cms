import type { Metadata } from "next";
import { Suspense } from "react";
import { CollectionsPage } from "@/features/storefront";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = buildRouteMetadata("store-collections");

export default function Page() {
  return (
    <Suspense fallback={<CollectionsPageFallback />}>
      <CollectionsPage />
    </Suspense>
  );
}

function CollectionsPageFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <Skeleton className="mb-4 h-8 w-48" />
      <Skeleton className="mb-8 h-4 w-96" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    </div>
  );
}
