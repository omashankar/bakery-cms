import type { Metadata } from "next";
import { getStorefrontProductCards } from "@/features/products/data/products-service";
import { Suspense } from "react";
import { SearchPage } from "@/apps/website";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = buildRouteMetadata("store-search");

export default async function Page() {
  const catalog = await getStorefrontProductCards();

  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchPage catalog={catalog} />
    </Suspense>
  );
}

function SearchPageFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <Skeleton className="mb-6 h-10 w-full max-w-xl" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    </div>
  );
}
