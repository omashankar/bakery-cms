"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { CakeProductCard } from "@/features/landing/components/cake-product-card";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { searchCakes } from "@/features/storefront/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { layoutSpacing } from "@/constants/spacing";

export function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const results = useMemo(() => searchCakes(query), [query]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`?${params.toString()}`);
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
          <form onSubmit={handleSearch} className="mb-8 flex max-w-xl gap-2">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search for chocolate, wedding, red velvet..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button type="submit">Search</Button>
          </form>

          <p className="mb-6 text-sm text-muted-foreground">
            {results.length} result{results.length === 1 ? "" : "s"}
            {initialQuery ? ` for "${initialQuery}"` : ""}
          </p>

          {results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-cream-50 py-16 text-center">
              <p className="font-medium">No results found</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search term or browse collections.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {results.map((cake) => (
                <CakeProductCard key={cake.id} cake={cake} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
