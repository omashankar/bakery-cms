"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { ScrollReveal, StaggerReveal } from "@/components/shared/scroll-reveal";
import type { LandingProduct } from "@/constants/landing-data";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import { searchProducts } from "@/features/products/lib/product-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";

const POPULAR_SEARCHES = [
  "Chocolate",
  "Wedding",
  "Red Velvet",
  "Eggless",
  "Photo Cake",
  "Butterscotch",
];

interface SearchPageProps {
  /** Catalogue fetched on the server, so results render into the HTML. */
  catalog: LandingProduct[];
}

export function SearchPage({ catalog }: SearchPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  // Searching stays on the client (it is interactive); the catalogue it searches
  // now arrives from the server, so the first paint already shows results.
  const results = useMemo(() => searchProducts(query, catalog), [query, catalog]);

  function runSearch(term: string) {
    const params = new URLSearchParams();
    if (term.trim()) params.set("q", term.trim());
    router.push(`?${params.toString()}`);
  }

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    runSearch(query);
  }

  return (
    <>
      <StorePageHeader
        title="Search"
        description="Find cakes by name, flavour, or category."
        breadcrumbs={[{ label: "Search" }]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          {/* Search hero */}
          <ScrollReveal className="mx-auto max-w-2xl text-center">
            <form onSubmit={handleSearch} className="flex flex-col gap-2.5 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-12 rounded-xl pl-11 text-base"
                  placeholder="Search for chocolate, wedding, red velvet..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                />
              </div>
              <Button type="submit" size="lg" className="h-12 rounded-xl">
                <Search className="size-4" />
                Search
              </Button>
            </form>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Popular:</span>
              {POPULAR_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => runSearch(term)}
                  className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-muted-foreground transition-all hover:border-bakery-300 hover:text-bakery-700"
                >
                  {term}
                </button>
              ))}
            </div>
          </ScrollReveal>

          <p className="mt-10 mb-6 text-sm text-muted-foreground">
            {`${results.length} result${results.length === 1 ? "" : "s"}${initialQuery ? ` for "${initialQuery}"` : ""}`}
          </p>

          {results.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-cream-50 py-16 text-center">
              <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-white text-bakery-400 shadow-sm">
                <Search className="size-6" />
              </span>
              <p className="font-heading text-lg font-semibold">No results found</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                We couldn&apos;t find any cakes matching {initialQuery ? `"${initialQuery}"` : "your search"}.
                Try a different term or browse our full collection.
              </p>
              <Button variant="outline" className="mt-5" render={<Link href={routes.store.collections} />}>
                Browse Collections
              </Button>
            </div>
          ) : (
            <StaggerReveal
              key={initialQuery}
              className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            >
              {results.map((cake) => (
                <ProductCard key={cake.id} cake={cake} />
              ))}
            </StaggerReveal>
          )}
        </div>
      </section>
    </>
  );
}
