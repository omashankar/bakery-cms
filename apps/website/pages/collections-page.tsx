"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, SearchX, SlidersHorizontal } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { CollectionFiltersPanel } from "@/components/storefront/collection-filters-panel";
import { StaggerReveal } from "@/components/shared/scroll-reveal";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import { useBusinessLabels } from "@/hooks/use-business-labels";
import {
  filterProductsByCategory,
  productsInCollection,
  productsTaggedForOccasion,
} from "@/features/products/lib/product-catalog";
import type { LandingProduct } from "@/constants/landing-data";
import {
  applyCollectionFilters,
  collectionPriceCeiling,
  countActiveFilters,
  defaultCollectionFilters,
  getFilterFlavourOptions,
  getFilterOccasionOptions,
  getFilterOptionFacets,
  getFilterWeightOptions,
  pruneOptionSelections,
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
  /**
   * What the shop's customer typed into the header, straight off the URL.
   *
   * Blank is the ordinary case and means 'browse everything' — which is
   * what the header's phone icon and the drawer's row both do.
   */
  initialSearch?: string;
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
  /**
   * The CURATED group this URL resolved to, when it resolved to one.
   *
   * Present and the grid is the owner's own list, in their own order.
   * Absent and every line below behaves exactly as it did before
   * collections existed — this page has one listing engine and one set of
   * filters, and a collection is a different SOURCE for it, not a second
   * page.
   */
  collection?: {
    name: string;
    description?: string;
    productIds: string[];
  };
  /**
   * The OCCASION this URL resolved to, when it resolved to one.
   *
   * A third source for the same listing engine, on the same footing as a
   * collection. It exists because an occasion and a category could not both
   * have a page: they shared `/store/collections/<slug>` and the listing
   * there ORs the two, so this shop's "Birthday" occasion — 19 products — was
   * merged into "Birthday Cakes" and shown under the category's name.
   *
   * A MATCH, not a list: membership is tagged on the product, so unlike a
   * collection there is no curated order to preserve and nothing to walk.
   */
  occasion?: {
    name: string;
    slug: string;
    description?: string;
  };
}

export function CollectionsPage({
  categorySlug: categorySlugProp,
  initialSearch = "",
  catalog,
  categories: categoriesFromShop,
  collection,
  occasion,
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
  const inCategory = useMemo(() => {
    // A collection is a LIST, not a match. `productsInCollection` walks the
    // ids so the owner's order survives and a product that merely shares the
    // name is not swept in.
    if (collection) return productsInCollection(catalog, collection.productIds);
    /*
      An occasion matches the product's own tags, and ONLY those — not the
      category that happens to share its slug. `filterProductsByCategory` ORs
      the two, which is right at the old address and wrong here: the point of
      this page is to show what the shop tagged for this occasion.
    */
    if (occasion) return productsTaggedForOccasion(catalog, occasion.slug);
    return filterProductsByCategory(catalog, categorySlug || undefined, categoryPills);
  }, [catalog, categorySlug, categoryPills, collection, occasion]);

  const activeCategory = categoryPills.find((cat) => cat.slug === categorySlug);
  /**
   * One resolved source for every heading on this page.
   *
   * The title, the subtitle, the breadcrumb tail and the empty state each
   * used to key off `activeCategory` independently — four places to forget.
   * A collection comes first because the route resolves it first.
   */
  const heading = collection ?? occasion ?? activeCategory;
  /**
   * The top of the price slider, from the shop's OWN catalogue.
   *
   * Computed over the whole catalogue rather than the current category, so
   * moving between categories does not move the slider under the customer —
   * and so the ceiling is never below a price on screen.
   */
  const priceCeiling = useMemo(() => collectionPriceCeiling(catalog), [catalog]);
  /**
   * Every filter box is built from THIS CATEGORY, never from the whole shop.
   *
   * A size, a flavour or an occasion is offered exactly when something in
   * front of the customer has it, so a tick can never hide everything. These
   * three read `catalog` — the whole published catalogue — while the option
   * facets below already read `inCategory`, and the comment above them
   * explained why: on a mixed shop the one Size box listed 0.5 kg, 1 kg,
   * Small, Large and 65W together, and ticking a cake size on the Plants page
   * emptied the grid with nothing on screen to say why.
   *
   * `inCategory` and not the FILTERED result: it moves with the route, never
   * with a tick, so the boxes do not vanish as the customer uses them.
   */
  const sizeOptions = useMemo(() => getFilterWeightOptions(inCategory), [inCategory]);
  const flavourOptions = useMemo(() => getFilterFlavourOptions(inCategory), [inCategory]);
  const occasionOptions = useMemo(() => getFilterOccasionOptions(inCategory), [inCategory]);
  /**
   * The filter boxes, built from THIS CATEGORY rather than the whole shop.
   *
   * Not `catalog`, and the difference is visible: a shop whose Chargers carry
   * a “Wattage” group would otherwise head a box “Wattage” on the Plants page
   * too, where nothing answers it — and since a product that does not carry a
   * group falls back to its own words, every tick of that box empties the grid
   * with nothing on screen to say why.
   *
   * `inCategory` is not the FILTERED result, which is the trap the note above
   * `sizeOptions` warns about: it moves with the route, never with a tick, so
   * the boxes do not vanish as the customer uses them.
   */
  const optionFacets = useMemo(() => getFilterOptionFacets(inCategory), [inCategory]);
  const [filters, setFilters] = useState<CollectionFilters>(() => ({
    ...defaultCollectionFilters(collectionPriceCeiling(catalog)),
    search: initialSearch,
  }));
  /**
   * RE-SEEDED, NOT JUST SEEDED, AND THIS IS THE WHOLE TRAP.
   *
   * The initialiser above runs ONCE. Searching from the header a second
   * time is a same-route navigation — /store/collections?q=a to ?q=b — so
   * this component does not remount, the initialiser does not run again,
   * and the second search would quietly show the first search's results.
   *
   * It passes a first manual test and fails the second, which is the worst
   * shape a bug can have. The page this replaces had exactly this effect
   * for exactly this reason.
   */
  useEffect(() => {
    setFilters((current) =>
      current.search === initialSearch ? current : { ...current, search: initialSearch },
    );
  }, [initialSearch]);
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
  /**
   * The ticks that still mean something on THIS page.
   *
   * A customer ticks “Wattage: 65W” on Chargers and clicks through to Plants,
   * where no box shows it — and because a product that does not carry a group
   * falls back to its own words, that tick would empty the grid with nothing on
   * screen to explain it.
   *
   * Derived rather than written back into state. Writing back would be a
   * setState inside an effect — a cascading render on every category change —
   * and it would also FORGET the tick, so walking back to Chargers would lose
   * it. `pruneOptionSelections` returns the same object when nothing is
   * dropped, so `filters` identity still changes only on a user action, which
   * is what keeps the `setPage(1)` effect below from firing every render.
   */
  const shownFilters = useMemo(
    () =>
      pruneOptionSelections(filters, optionFacets, {
        // The other three list axes, each exactly as the boxes offer it. They
        // were not pruned at all: a size ticked on Cakes was carried into
        // Plants, where no box shows it and every plant is hidden by it.
        weights: sizeOptions,
        flavours: flavourOptions,
        occasions: occasionOptions,
      }),
    [filters, optionFacets, sizeOptions, flavourOptions, occasionOptions],
  );

  const filtered = useMemo(
    () => applyCollectionFilters(inCategory, shownFilters),
    [inCategory, shownFilters],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activeFilterCount = countActiveFilters(shownFilters, priceCeiling);
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
        title={heading ? heading.name : labels.collectionsTitle}
        breadcrumbs={[
          { label: "Collections", href: routes.store.collections },
          ...(heading ? [{ label: heading.name }] : []),
        ]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
            <CollectionFiltersPanel
              filters={shownFilters}
              priceCeiling={priceCeiling}
              sizeOptions={sizeOptions}
              flavourOptions={flavourOptions}
              occasionOptions={occasionOptions}
              optionFacets={optionFacets}
              idPrefix="side-"
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
                        filters={shownFilters}
                        priceCeiling={priceCeiling}
                        sizeOptions={sizeOptions}
                        flavourOptions={flavourOptions}
                        occasionOptions={occasionOptions}
                        optionFacets={optionFacets}
                        idPrefix="sheet-"
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

              {/*
                THE TERM IS ECHOED, because this page is now where a search
                lands. Without it the only trace of what was typed is the
                input itself, and a customer who scrolls past it cannot tell
                a short list from a broken one.
              */}
              <p className="mb-4 text-sm text-muted-foreground">
                {filters.search.trim()
                  ? `Showing ${paginated.length} of ${filtered.length} ${labels.productWordPlural.toLowerCase()} for “${filters.search.trim()}”`
                  : `Showing ${paginated.length} of ${filtered.length} ${labels.productWordPlural.toLowerCase()}`}
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
                    {/* `heading`, not `activeCategory` — an empty COLLECTION
                        would otherwise fall to the generic line and lose the
                        name the owner is looking at. */}
                    {categoryIsEmpty && heading
                      ? `No ${labels.productWordPlural.toLowerCase()} in ${heading.name} yet`
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
                  className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3"
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
          : "border-border bg-card text-muted-foreground hover:border-bakery-300 hover:text-bakery-700"
      )}
    >
      {label}
    </Link>
  );
}
