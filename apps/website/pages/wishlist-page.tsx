"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StaggerReveal } from "@/components/shared/scroll-reveal";
import { Button } from "@/components/ui/button";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import { getWishlistSlugs } from "@/apps/website/lib/wishlist";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import type { LandingProduct } from "@/constants/landing-data";

interface WishlistPageProps {
  /** Catalogue fetched on the server; the saved slugs themselves are browser-local. */
  catalog: LandingProduct[];
}

export function WishlistPage({ catalog }: WishlistPageProps) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = () => setSlugs(getWishlistSlugs());
    load();
    setLoaded(true);
    window.addEventListener("bakery-wishlist-updated", load);
    return () => window.removeEventListener("bakery-wishlist-updated", load);
  }, []);

  const bySlug = new Map(catalog.map((cake) => [cake.slug, cake]));
  const cakes = slugs
    .map((slug) => bySlug.get(slug))
    .filter((cake): cake is LandingProduct => Boolean(cake));

  return (
    <>
      <StorePageHeader
        title="Wishlist"
        description="Save cakes you love for later."
        breadcrumbs={[{ label: "Wishlist" }]}
      />
      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          {!loaded ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="aspect-square animate-pulse bg-cream-100" />
                  <div className="space-y-3 p-3.5">
                    <div className="h-3 w-1/3 animate-pulse rounded bg-cream-100" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-cream-100" />
                    <div className="h-5 w-1/2 animate-pulse rounded bg-cream-100" />
                    <div className="h-10 w-full animate-pulse rounded-lg bg-cream-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : cakes.length === 0 ? (
            <EmptyState
              className="border-border bg-cream-50"
              icon={Heart}
              title="Your wishlist is empty"
              description="Tap the heart on any cake to save it here."
              action={
                <Button variant="bakery" render={<Link href={routes.store.collections} />}>
                  Browse Cakes
                </Button>
              }
            />
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{cakes.length}</span>{" "}
                  {cakes.length === 1 ? "cake" : "cakes"} saved
                </p>
                <Button variant="outline" size="sm" render={<Link href={routes.store.collections} />}>
                  Continue Shopping
                </Button>
              </div>
              <StaggerReveal className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {cakes.map((cake) => (
                  <ProductCard key={cake.id} cake={cake} />
                ))}
              </StaggerReveal>
            </>
          )}
        </div>
      </section>
    </>
  );
}
