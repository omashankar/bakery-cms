"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { CollectionFiltersPanel } from "@/components/storefront/collection-filters-panel";
import { StaggerReveal } from "@/components/shared/scroll-reveal";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import { filterProductsByCategory } from "@/features/products/lib/product-catalog";
import type { LandingProduct } from "@/constants/landing-data";
import {
  DEFAULT_COLLECTION_FILTERS,
  applyCollectionFilters,
  countActiveFilters,
  type CollectionFilters,
} from "@/apps/website/lib/collection-filters";
import { categories } from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

interface CollectionsPageProps {
  categorySlug?: string;
  /** Catalogue fetched on the server, so the grid renders into the HTML. */
  catalog: LandingProduct[];
}

export function CollectionsPage({
  categorySlug: categorySlugProp,
  catalog,
}: CollectionsPageProps) {
  const categorySlug = categorySlugProp ?? "";
  const activeCategory = categories.find((cat) => cat.slug === categorySlug);
  const [filters, setFilters] = useState<CollectionFilters>(DEFAULT_COLLECTION_FILTERS);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  // Filtering stays on the client (it is interactive), but the catalogue it
  // filters now arrives from the server, so the first paint shows real cakes.
  const filtered = useMemo(() => {
    let byCategory = filterProductsByCategory(catalog, categorySlug || undefined);
    // Never dead-end a valid category page — fall back to the full catalogue.
    if (categorySlug && byCategory.length === 0) byCategory = catalog;
    return applyCollectionFilters(byCategory, filters);
  }, [catalog, categorySlug, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activeFilterCount = countActiveFilters(filters);

  useEffect(() => {
    setPage(1);
  }, [categorySlug, filters]);

  const updateFilters = (next: CollectionFilters) => setFilters(next);

  return (
    <>
      <StorePageHeader
        title={activeCategory ? activeCategory.name : "Our Collections"}
        description={
          activeCategory
            ? `Browse our ${activeCategory.name.toLowerCase()} — premium quality, freshly baked.`
            : "Browse premium cakes by category, flavour, and occasion."
        }
        breadcrumbs={[
          { label: "Collections", href: routes.store.collections },
          ...(activeCategory ? [{ label: activeCategory.name }] : []),
        ]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
            <CollectionFiltersPanel
              filters={filters}
              onChange={updateFilters}
              className="hidden lg:block lg:sticky lg:top-24 lg:self-start"
            />

            <div>
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative max-w-md flex-1">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search cakes..."
                    value={filters.search}
                    onChange={(event) =>
                      updateFilters({ ...filters, search: event.target.value })
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                    <DialogTrigger
                      render={
                        <Button variant="outline" className="lg:hidden">
                          <SlidersHorizontal className="size-4" />
                          Filters
                          {activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                        </Button>
                      }
                    />
                    <DialogContent className="max-h-[85vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Filters</DialogTitle>
                      </DialogHeader>
                      <CollectionFiltersPanel
                        filters={filters}
                        onChange={(next) => {
                          updateFilters(next);
                        }}
                        className="border-0 p-0 shadow-none"
                      />
                      <Button className="w-full" onClick={() => setMobileFiltersOpen(false)}>
                        Apply Filters
                      </Button>
                    </DialogContent>
                  </Dialog>
                  <select
                    value={filters.sort}
                    onChange={(event) =>
                      updateFilters({
                        ...filters,
                        sort: event.target.value as CollectionFilters["sort"],
                      })
                    }
                    className="h-10 rounded-xl border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="popular">Sort: Popular</option>
                    <option value="name">Sort: Name</option>
                    <option value="price-asc">Sort: Price Low–High</option>
                    <option value="price-desc">Sort: Price High–Low</option>
                  </select>
                </div>
              </div>

              <p className="mb-4 text-sm text-muted-foreground">
                {`Showing ${paginated.length} of ${filtered.length} cakes`}
              </p>

              <div className="mb-8 flex flex-wrap gap-2">
                <CategoryPill
                  label="All"
                  active={!categorySlug}
                  href={routes.store.collections}
                />
                {categories.map((cat) => (
                  <CategoryPill
                    key={cat.id}
                    label={cat.name}
                    active={categorySlug === cat.slug}
                    href={routes.store.collection(cat.slug)}
                  />
                ))}
              </div>

              {paginated.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-cream-50 py-16 text-center">
                  <p className="font-medium">No cakes found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try adjusting your search or filters.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => updateFilters(DEFAULT_COLLECTION_FILTERS)}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : (
                <StaggerReveal
                  key={`${categorySlug}-${currentPage}`}
                  className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3"
                >
                  {paginated.map((cake) => (
                    <ProductCard key={cake.id} cake={cake} />
                  ))}
                </StaggerReveal>
              )}

              {filtered.length > PAGE_SIZE ? (
                <Pagination className="mt-10">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          setPage((value) => Math.max(1, value - 1));
                        }}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }).map((_, index) => (
                      <PaginationItem key={index}>
                        <PaginationLink
                          href="#"
                          isActive={currentPage === index + 1}
                          onClick={(event) => {
                            event.preventDefault();
                            setPage(index + 1);
                          }}
                        >
                          {index + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          setPage((value) => Math.min(totalPages, value + 1));
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function CategoryPill({
  label,
  active,
  href,
}: {
  label: string;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm font-medium transition-premium",
        active
          ? "border-bakery-700 bg-bakery-700 text-white shadow-sm"
          : "border-border bg-white text-muted-foreground hover:border-bakery-300 hover:text-bakery-700"
      )}
    >
      {label}
    </Link>
  );
}
