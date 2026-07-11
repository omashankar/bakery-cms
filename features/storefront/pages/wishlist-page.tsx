"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { getCakeBySlug } from "@/features/storefront/lib/catalog";
import { getWishlistSlugs } from "@/features/storefront/lib/wishlist";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";

export function WishlistPage() {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = () => setSlugs(getWishlistSlugs());
    load();
    setLoaded(true);
    window.addEventListener("bakery-wishlist-updated", load);
    return () => window.removeEventListener("bakery-wishlist-updated", load);
  }, []);

  const cakes = slugs
    .map((slug) => getCakeBySlug(slug))
    .filter((cake): cake is NonNullable<typeof cake> => Boolean(cake));

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
            <div className="h-40 animate-pulse rounded-xl border border-border bg-cream-100" />
          ) : cakes.length === 0 ? (
            <EmptyState
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
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {cakes.map((cake) => (
                <ProductCard key={cake.id} cake={cake} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
