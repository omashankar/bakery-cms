"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, X } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { EmptyState } from "@/components/shared/empty-state";
import { StaggerReveal } from "@/components/shared/scroll-reveal";
import { Button } from "@/components/ui/button";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import { toast } from "@/lib/lazy-toast";
import { getWishlistSlugs, pruneWishlist, toggleWishlist } from "@/apps/website/lib/wishlist";
import { useBusinessLabels } from "@/hooks/use-business-labels";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import type { LandingProduct } from "@/constants/landing-data";

// Two across on a phone (it was ONE, a full-width card per saved item), up to
// five on a wide screen, as the reference lays its wishlist out.
const WISHLIST_GRID = "grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

interface WishlistPageProps {
  /** Catalogue fetched on the server; the saved slugs themselves are browser-local. */
  catalog: LandingProduct[];
}

export function WishlistPage({ catalog }: WishlistPageProps) {
  const [slugs, setSlugs] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const labels = useBusinessLabels();

  useEffect(() => {
    /**
     * Saved cakes the shop no longer publishes are forgotten here.
     *
     * This page resolves slugs against the published catalogue and drops the
     * ones it cannot find, but the header badge counts the RAW slugs — so a
     * customer with two unpublished cakes saw "5" beside the heart and three
     * cards below it, with no row for the missing two and therefore no way to
     * remove them. This is the only screen that holds the catalogue, so it is
     * the only place that can tell a stale entry from a live one.
     */
    const removed = pruneWishlist(catalog.map((cake) => cake.slug));
    if (removed > 0) {
      toast.info(
        `${removed} saved ${removed === 1 ? "item is" : "items are"} no longer available and ${
          removed === 1 ? "has" : "have"
        } been removed from your wishlist.`,
      );
    }

    const load = () => setSlugs(getWishlistSlugs());
    load();
    setLoaded(true);
    window.addEventListener("bakery-wishlist-updated", load);
    return () => window.removeEventListener("bakery-wishlist-updated", load);
  }, [catalog]);

  const bySlug = new Map(catalog.map((cake) => [cake.slug, cake]));
  const cakes = slugs
    .map((slug) => bySlug.get(slug))
    .filter((cake): cake is LandingProduct => Boolean(cake));

  return (
    <>
      <StorePageHeader title="My Wishlist" breadcrumbs={[{ label: "Wishlist" }]} titleOwnedByPage />
      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          {/*
            A TITLE YOU CAN SEE, with the count in it — "My Wishlist (9)", as
            the reference heads the page. The heading was screen-reader only,
            so the page opened on a grid with nothing saying what it was.
          */}
          <h1 className="mb-6 text-center font-heading text-2xl font-bold tracking-tight sm:mb-8 sm:text-3xl">
            My Wishlist{loaded && cakes.length > 0 ? ` (${cakes.length})` : ""}
          </h1>
          {!loaded ? (
            <div className={WISHLIST_GRID}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
                  <div className="aspect-square animate-pulse bg-cream-100" />
                  <div className="space-y-2.5 p-2.5">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-cream-100" />
                    <div className="h-5 w-1/2 animate-pulse rounded bg-cream-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : cakes.length === 0 ? (
            <EmptyState
              className="border-border bg-cream-50"
              icon={Heart}
              title="Your wishlist is empty"
              description={`Tap the heart on any ${labels.productWord.toLowerCase()} to save it here.`}
              action={
                <Button variant="bakery" render={<Link href={routes.store.collections} />}>
                  {`Browse ${labels.productWordPlural}`}
                </Button>
              }
            />
          ) : (
            <StaggerReveal className={WISHLIST_GRID}>
              {cakes.map((cake) => (
                /*
                  REMOVED BY AN ✕, not by the heart. A heart on a page of
                  things already hearted asks "save this?" of something saved;
                  the reference puts a plain ✕ in the corner, which says what
                  pressing it does.
                */
                <div key={cake.id} className="relative">
                  <ProductCard cake={cake} framed showWishlist={false} />
                  <button
                    type="button"
                    onClick={() => toggleWishlist(cake.slug)}
                    aria-label={`Remove ${cake.name} from your wishlist`}
                    className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-sm transition-colors hover:bg-card hover:text-destructive"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
            </StaggerReveal>
          )}
        </div>
      </section>
    </>
  );
}
