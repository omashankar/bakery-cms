"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CakeProductCard } from "@/features/landing/components/cake-product-card";
import { ScrollReveal, StaggerReveal } from "@/components/shared/scroll-reveal";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { searchCakes } from "@/features/storefront/lib/catalog";
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

export function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);

  // Cakes merge localStorage-backed admin data (absent during SSR) — defer to the
  // client to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const results = useMemo(() => (mounted ? searchCakes(query) : []), [query, mounted]);

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
            {mounted
              ? `${results.length} result${results.length === 1 ? "" : "s"}${initialQuery ? ` for "${initialQuery}"` : ""}`
              : "Loading cakes…"}
          </p>

          {!mounted ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-80 animate-pulse rounded-xl border border-border bg-cream-100"
                />
              ))}
            </div>
          ) : results.length === 0 ? (
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
                <CakeProductCard key={cake.id} cake={cake} />
              ))}
            </StaggerReveal>
          )}
        </div>
      </section>
    </>
  );
}
