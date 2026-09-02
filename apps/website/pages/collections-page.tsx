"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, SearchX, SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { CollectionFiltersPanel } from "@/components/storefront/collection-filters-panel";
import { StaggerReveal } from "@/components/shared/scroll-reveal";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import { useBusinessLabels } from "@/hooks/use-business-labels";
import { filterProductsByCategory } from "@/features/products/lib/product-catalog";
import type { LandingProduct } from "@/constants/landing-data";
import {
  applyCollectionFilters,
  collectionPriceCeiling,
  countActiveFilters,
  defaultCollectionFilters,
  type CollectionFilters,
} from "@/apps/website/lib/collection-filters";
import { categories as demoCategories } from "@/constants/landing-data";
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
  /**
   * The SHOP's own categories, from Catalog settings.
   *
   * The pills below were `categories` from landing-data — the shipped demo
   * taxonomy — so a category the shop added had no pill and could only be
   * reached by typing its URL, a renamed one still showed its old name, and a
   * deleted one kept a pill that led nowhere. This shop has 13 categories and
   * the hardcoded list has 9.
   */
  categories?: { id: string; name: string; slug: string }[];
}

export function CollectionsPage({
  categorySlug: categorySlugProp,
  catalog,
  categories: categoriesFromShop,
}: CollectionsPageProps) {
  const categorySlug = categorySlugProp ?? "";
  /**
   * De-duplicated by slug: the categories list is admin-typed and this shop
   * already has two rows called "Seasonal" with the same slug, which would
   * render two identical pills pointing at the same page.
   */
  const categoryPills = useMemo(() => {
    const source = categoriesFromShop?.length ? categoriesFromShop : demoCategories;
    const bySlug = new Map<string, { id: string; name: string; slug: string }>();
    for (const category of source) {
      if (category.slug && !bySlug.has(category.slug)) bySlug.set(category.slug, category);
    }
    return [...bySlug.values()];
  }, [categoriesFromShop]);

  // Filtering stays on the client (it is interactive), but the catalogue it
  // filters arrives from the server, so the first paint shows real cakes. The
  // pills are passed too: a category's slug and its name are edited
  // independently, so only this list can say which product belongs to which
  // route — "Birthday Cakes" lives at /birthday here.
  const inCategory = useMemo(
    () => filterProductsByCategory(catalog, categorySlug || undefined, categoryPills),
    [catalog, categorySlug, categoryPills],
  );

  const activeCategory = categoryPills.find((cat) => cat.slug === categorySlug);
  /**
   * The top of the price slider, from the shop's OWN catalogue.
   *
   * Computed over the whole catalogue rather than the current category, so
   * moving between categories does not move the slider under the customer —
   * and so the ceiling is never below a price on screen.
   */
  const priceCeiling = useMemo(() => collectionPriceCeiling(catalog), [catalog]);
  const [filters, setFilters] = useState<CollectionFilters>(() =>
    defaultCollectionFilters(collectionPriceCeiling(catalog)),
  );
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  /**
   * The shared hook, not a local copy of it.
   *
   * This held `useState<BusinessLabels | null>(null)` and re-implemented
   * `useBusinessLabels` in an effect below — so every read needed a `?? "Cakes"`
   * fallback, and those six literals were what a florist’s shop-all page
   * actually rendered on the server and on first paint. The hook seeds the
   * NEUTRAL defaults, which is hydration-safe for the same reason null was and
   * does not name a trade.
   */
  const labels = useBusinessLabels();
  // Filtering stays on the client (it is interactive), but the catalogue it
  // filters now arrives from the server, so the first paint shows real cakes.

  /**
   * A category with nothing in it shows nothing.
   *
   * This used to fall back to the entire catalogue — "Never dead-end a valid
   * category page" — under that category's heading and its own description:
   * "Browse our wedding cakes — premium quality, freshly baked", above every
   * cheesecake and cupcake the shop sells. A customer filtering to a category
   * was shown the opposite of what they asked for and given no sign of it.
   * An honest empty state is the smaller disappointment.
   */
  const filtered = useMemo(
    () => applyCollectionFilters(inCategory, filters),
    [inCategory, filters],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activeFilterCount = countActiveFilters(filters, priceCeiling);
  // Nothing here at all, versus nothing that matches what was ticked. "Try
  // adjusting your filters" is useless advice when no filter is the reason.
  const categoryIsEmpty = Boolean(categorySlug) && inCategory.length === 0;

  useEffect(() => {
    setPage(1);
  }, [categorySlug, filters]);


  const updateFilters = (next: CollectionFilters) => setFilters(next);

  return (
    <>
      <StorePageHeader
        title={activeCategory ? activeCategory.name : labels.collectionsTitle}
        description={
          activeCategory
            ? // “freshly baked”, under a category heading, in a shop that may
              // sell chargers. The category name is the shop’s own already.
              `Browse our ${activeCategory.name.toLowerCase()}.`
            : labels.collectionsSubtitle
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
              priceCeiling={priceCeiling}
              onChange={updateFilters}
              className="hidden lg:block lg:sticky lg:top-24 lg:self-start"
            />

            <div>
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative max-w-md flex-1">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder={`Search ${labels.productWordPlural.toLowerCase()}...`}
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
                        priceCeiling={priceCeiling}
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
                    className="h-8 rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <option value="popular">Sort: Popular</option>
                    <option value="name">Sort: Name</option>
                    <option value="price-asc">Sort: Price Low–High</option>
                    <option value="price-desc">Sort: Price High–Low</option>
                  </select>
                </div>
              </div>

              <p className="mb-4 text-sm text-muted-foreground">
                {`Showing ${paginated.length} of ${filtered.length} ${labels.productWordPlural.toLowerCase()}`}
              </p>

              {/* Named, so it reads as one group of related links rather than
                  a loose row of anchors. */}
              <nav aria-label="Categories" className="mb-8 flex flex-wrap gap-2">
                <CategoryPill
                  label="All"
                  active={!categorySlug}
                  href={routes.store.collections}
                />
                {categoryPills.map((cat) => (
                  <CategoryPill
                    key={cat.id}
                    label={cat.name}
                    active={categorySlug === cat.slug}
                    href={routes.store.collection(cat.slug)}
                  />
                ))}
              </nav>

              {paginated.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-cream-50 py-16 text-center">
                  <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-cream-100 text-bakery-700">
                    <SearchX className="size-6" />
                  </div>
                  <p className="font-medium">
                    {categoryIsEmpty && activeCategory
                      ? `No ${labels.productWordPlural.toLowerCase()} in ${activeCategory.name} yet`
                      : `No ${labels.productWordPlural.toLowerCase()} found`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {categoryIsEmpty
                      ? "Have a look at the rest of our collections."
                      : "Try adjusting your search or filters."}
                  </p>
                  {categoryIsEmpty ? (
                    <Button variant="outline" className="mt-4" render={<Link href={routes.store.collections} />}>
                      Browse all collections
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => updateFilters(defaultCollectionFilters(priceCeiling))}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                <StaggerReveal
                  key={`${categorySlug}-${currentPage}`}
                  className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
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
