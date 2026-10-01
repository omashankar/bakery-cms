"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownUp, ChevronDown, IndianRupee, SearchX, X } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
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
  defaultCollectionFilters,
  getFilterFlavourOptions,
  getFilterOccasionOptions,
  getFilterOptionFacets,
  getFilterWeightOptions,
  priceBandsFor,
  pruneOptionSelections,
  type CollectionFilters,
} from "@/apps/website/lib/collection-filters";
import { categories as demoCategories } from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import { storefrontHeading } from "@/constants/typography";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";

/**
 * TWENTY-FOUR, and the number is the grid rather than a preference.
 *
 * It was eight, which is two rows of four, three of three and four of two —
 * a third of one screen at 1440. Twenty-four divides by 2, 3 and 4, so the
 * last row is full at every breakpoint this grid uses instead of leaving one
 * card stranded beside two gaps.
 *
 * The owner's own correction is behind this: do not size the page to the 27
 * products here today. At eight, a shop with three hundred asks its customer
 * to press Next thirty-seven times.
 */
const PAGE_SIZE = 24;

/** How many numbered slots the pagination draws before it starts eliding. */
const PAGE_SLOTS = 7;

/**
 * The sort options, once.
 *
 * The cell shows the chosen one as text and the hidden `<select>` lists them
 * all; written twice they drift, and the visible word stops matching what is
 * actually sorting.
 */
const SORT_LABELS: Record<CollectionFilters["sort"], string> = {
  popular: "Popular",
  name: "Name",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
};

/**
 * The page numbers to draw, with `null` where the run breaks.
 *
 * Exported and pure so the shape is asserted by what it RETURNS rather than
 * by counting anchors in a rendered page — a check that passes for a
 * component that computes a window and renders every page anyway.
 *
 * First and last always, the current page with one neighbour either side, and
 * an ellipsis across each gap. Under eight pages there is no gap to make, so
 * every page is drawn and the function is the identity it used to be.
 */
export function paginationWindow(total: number, current: number): (number | null)[] {
  const pages = Math.max(1, Math.trunc(total) || 1);
  if (pages <= PAGE_SLOTS) return Array.from({ length: pages }, (_, i) => i + 1);

  const here = Math.min(Math.max(Math.trunc(current) || 1, 1), pages);
  const wanted = new Set([1, pages, here, here - 1, here + 1]);
  /*
    The ends keep their width when the cursor is near them, so the control
    does not shrink from seven slots to five as a customer walks to page 2.
  */
  if (here <= 3) [2, 3, 4].forEach((n) => wanted.add(n));
  if (here >= pages - 2) [pages - 1, pages - 2, pages - 3].forEach((n) => wanted.add(n));

  const shown = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

  const out: (number | null)[] = [];
  let previous = 0;
  for (const page of shown) {
    if (previous && page - previous > 1) out.push(null);
    out.push(page);
    previous = page;
  }
  return out;
}

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
  categories?: { id: string; name: string; slug: string; headline?: string }[];
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
    /*
      The shop's own phrase for this page, when it wrote one. On CatalogRow,
      so a category, an occasion and a collection all carry it and the
      listing page cannot head two of the three.
    */
    headline?: string;
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
    /*
      The shop's own phrase for this page, when it wrote one. On CatalogRow,
      so a category, an occasion and a collection all carry it and the
      listing page cannot head two of the three.
    */
    headline?: string;
    description?: string;
  };
  /**
   * The department this category sits under, when the shop has filed it.
   *
   * No `href`: a department has no page of its own yet, and a crumb is a
   * promise that a page exists. The trail above a product carries the same
   * word on the same terms — see `departmentCrumb` there — and both get it
   * from `departmentFor`, so the two cannot disagree about one category.
   */
  departmentCrumb?: { label: string };
}

export function CollectionsPage({
  categorySlug: categorySlugProp,
  initialSearch = "",
  catalog,
  categories: categoriesFromShop,
  collection,
  occasion,
  departmentCrumb,
}: CollectionsPageProps) {
  const categorySlug = categorySlugProp ?? "";
  /**
   * De-duplicated by slug: the categories list is admin-typed and this shop
   * already has two rows called "Seasonal" with the same slug, which would
   * render two identical pills pointing at the same page.
   */
  const categoryPills = useMemo(() => {
    const source = categoriesFromShop?.length ? categoriesFromShop : demoCategories;
    /*
      `headline` rides along, optional, because the demo fallback has none —
      the Map's type is what decides whether the shop's own phrase survives
      the dedup, and a narrower one silently drops it.
    */
    const bySlug = new Map<
      string,
      { id: string; name: string; slug: string; headline?: string }
    >();
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
  const pageWindow = paginationWindow(totalPages, currentPage);

  /*
    THE BANDS THIS PAGE CAN FILL, from the products in view rather than from
    the reference's fixed slices. Measured: its "499 and below / 500-999 /
    1000-1499 / 1500-2499 / 2500+" holds 0, 10, 12, 2 and 3 of this
    catalogue, so the first option would never match anything. Quartiles put
    roughly a quarter behind each band on any shop, at any size.
  */
  const priceBands = useMemo(() => priceBandsFor(inCategory), [inCategory]);
  const activeBand = priceBands.findIndex(
    (band) => filters.priceMin === band.min && filters.priceMax === band.max,
  );

  /*
    WHAT THIS PAGE IS CALLED, and it is the source's own name until the shop
    writes something else. `labels.collectionsTitle` is the shop-all fallback
    and is the shop's word, not this file's.
  */
  const pageTitle = heading
    ? /*
        THE SHOP'S OWN PHRASE IF IT WROTE ONE, else the row's name.

        A category is filed as "Orchids" and the page selling them may be
        headed "Orchid Flower Bouquets". `|| name` and not `?? name`, so a
        headline saved as an empty string — which a cleared admin box sends —
        falls back rather than heading the page with nothing.
      */
      (heading.headline?.trim() || heading.name)
    : labels.collectionsTitle;

  /*
    THE COUNT, AND THE SECOND NUMBER ONLY WHILE SOMETHING IS NARROWING.

    This read "Showing 8 of 10 products", which answered a question about
    pagination nobody asked and made a ten-product category look like a
    failing search. The total is what a customer wants; the filtered figure
    matters only when a filter or a search is on, and "10 of 10" is noise.
  */
  const narrowed = filtered.length !== inCategory.length;
  /*
    IN PARENTHESES, beside the name rather than under it — the shape the shop
    marked. It reads as an aside to the title instead of a second statement,
    which is what "Showing 8 of 10 products" on its own line used to be.
  */
  const countLine = narrowed
    ? `(${filtered.length} of ${inCategory.length} ${labels.productWordPlural.toLowerCase()})`
    : `(${inCategory.length} ${labels.productWordPlural.toLowerCase()})`;
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
        /* This page prints the name in its own bar — see the slim bar below. */
        titleOwnedByPage
        /*
          HOME › CHOCOLATES, not Home › Collections › Chocolates.

          The shop-all page sat in the middle of every category's trail. It is
          not a parent of this page — nothing led through it to get here, the
          header's menu links straight to the category — so it was a step in a
          journey nobody took, on the one line whose whole job is to say where
          you are.

          On the shop-all page itself it IS the page, so it stays there, and it
          is named `collectionsTitle` rather than "Collections" because a shop
          that renamed that page should not read a word it never wrote.
        */
        /*
          AND THE DEPARTMENT ABOVE IT, so this page says what the product page
          said. A product read `Home › Flowers › Roses › Bouquet`; clicking
          Roses — a crumb in that very trail — opened this page reading
          `Home › Roses`, and the department vanished on the step taken to
          reach it.

          `heading === activeCategory` AND NOT just `departmentCrumb`. The
          route resolves the crumb for the category case, but `heading` is
          `collection ?? occasion ?? activeCategory` and is resolved HERE — so
          a route that ever passed the crumb alongside a collection, or a page
          whose pills do not hold the category the route found, would read
          `Home › Flowers › All products`. One place decides what the trail is
          about, and it is the place that decides what the heading is.
        */
        breadcrumbs={
          heading
            ? [
                ...(departmentCrumb && heading === activeCategory ? [departmentCrumb] : []),
                { label: heading.name },
              ]
            : [{ label: labels.collectionsTitle }]
        }
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          {/*
            ONE COLUMN, AND THE FILTERS ARE A DOOR RATHER THAN A WALL.

            The panel was mounted TWICE — a `hidden lg:block` sidebar here and
            the dialog below — which is the whole reason `idPrefix` exists: two
            identical ids in one document, and a `<Label htmlFor>` binds to
            whichever came first, so a tap on a phone could toggle a checkbox
            nobody could see. One mount ends that class of bug, gives the grid
            the entire content column — four cards across instead of three —
            and makes the phone and the laptop the same page.

            NOTHING IS DELETED. Every group still filters, from the dialog. The
            shop complained about WHERE the filters are, not that they exist.

            The inner bare <div> stays on purpose: prettier is not a dependency
            here, so dropping a nesting level means re-indenting about 180 lines
            of a CRLF file by hand and burying this change in whitespace.
          */}
          <div>
            <div>
              {/*
                THE SLIM BAR — the page's name, its real count, and the two
                controls a buyer who arrived from a menu reaches for. One row
                from sm, two below it.

                NOT A BAND, and that is a requirement rather than a taste:
                `a-page-says-where-it-is-without-a-banner.spec.ts` finds the
                banner this page used to wear by what it LOOKED like — a
                tinted, border-closed, full-width block carrying the trail —
                so plain type on the page's own ground with one hairline under
                it is the only shape that passes.

                THE HEADING IS DRAWN ONLY WHERE THE ROUTE NAMED SOMETHING. On
                the shop-all page `heading` is undefined and it stays
                `sr-only`, because that same spec asserts the heading is not
                drawn there — and because "Our Collections" over a grid of
                collections is the caption on something already captioned.

                Four bands became one: the search row, the count line, the
                pill nav and the 240px sidebar column. The pills are not gone;
                they sit under the grid now, where chrome belongs on a page
                whose job is the grid.
              */}
              {/*
                ONE STRIP, which is the shape the shop pointed at.

                It was plain type on the page with a hairline under it, and on
                the shop-all page — where the heading is `sr-only` — that left
                a visible hole with the count stranded at the bottom of it.
                Measured: a 76px bar whose left column began 43px down and was
                20px tall.

                TINTED AND ROUNDED, WITHOUT THE BREADCRUMB IN IT. That is not
                a detail: `a-page-says-where-it-is-without-a-banner.spec.ts`
                calls a block a banner only when it is tinted AND
                border-closed AND `node.contains(crumb)`. The trail stays
                above, outside this box, exactly as it is on the layout the
                shop held up — so the strip is a control bar and not the band
                that was taken off sixteen pages.

                `bg-muted` rather than a cream: `--cream-50` is literally
                #ffffff and `--cream-100` is the shop's own surface, so on a
                page already sitting on the surface colour neither would show
                an edge at all.

                `items-center`, not `items-end`: with the heading hidden the
                left column is one line and the old baseline alignment pinned
                it to the floor of the strip.
              */}
              {/*
                SQUARE, not rounded, and flat against the column — the strip
                the shop marked has no corners and no shadow. It is a band of
                controls rather than a card sitting on the page.
              */}
              <div className="mb-5 flex flex-col gap-0 bg-muted sm:flex-row sm:items-stretch sm:justify-between">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-3">
                  <h1 className={heading ? storefrontHeading.page : "sr-only"}>{pageTitle}</h1>
                  <p className="text-sm text-muted-foreground">{countLine}</p>
                  {filters.search.trim() ? (
                    /*
                      THE TERM, AS A CHIP THAT CAN BE TAKEN OFF. The search box
                      moved into the dialog, so without this the only trace of
                      what was typed is behind a door, and a customer who
                      scrolls past cannot tell a short list from a broken one.
                      `after:-inset-2` makes a 32px chip a 48px target.
                    */
                    <button
                      type="button"
                      onClick={() => updateFilters({ ...filters, search: "" })}
                      className="relative inline-flex h-8 items-center gap-1 rounded-full border border-border bg-muted px-2.5 text-xs text-foreground after:absolute after:-inset-2 after:content-['']"
                    >
                      {`“${filters.search.trim()}”`}
                      <X aria-hidden="true" className="size-3" />
                      <span className="sr-only">Clear this search</span>
                    </button>
                  ) : null}
                </div>

                {/* `grid-cols-[1fr_auto]` on a phone: the sort takes the room
                    and the door sizes to its own words. */}
                {/*
                  TWO CELLS, DIVIDED, and nothing else — which is what the
                  shop asked for four times and drew a box round.

                  The facet panel that used to sit behind a Filters door is
                  gone from this page. I put the case for keeping it and they
                  said no extra filters at all; it is their shop. The
                  component is still in the repo, unrouted, because this is a
                  layout decision and deleting it would take the option
                  folding and its tests with it.

                  A THIRD CELL, "Delivery date", IS NOT HERE and that is
                  deliberate. Nothing on this shop could answer it: no
                  delivery tier is configured, no product carries one, and the
                  lead time is 0 days — so every date is available for every
                  product and the control would narrow nothing, ever. A filter
                  that looks finished and filters nothing is worse than an
                  absent one.
                */}
                <div className="grid grid-cols-2 divide-x divide-border border-t border-border sm:flex sm:shrink-0 sm:border-t-0 sm:border-l">
                  {priceBands.length > 0 ? (
                    <label className="relative flex min-w-0 flex-1 items-center gap-2 px-3 py-2 sm:flex-none sm:px-4">
                      <IndianRupee
                        aria-hidden="true"
                        className="size-4 shrink-0 text-muted-foreground"
                      />
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[11px] leading-tight font-medium text-muted-foreground">
                          Filter by price
                        </span>
                        {/*
                          THE VALUE IS THE VISIBLE THING, and the select above
                          it is stripped of its own chrome so the divider
                          between cells is what separates them — a bordered
                          box inside a bordered strip is two frames round one
                          control.

                          The native `<select>` is kept and simply made
                          transparent rather than replaced with a listbox: it
                          brings the keyboard, the phone's own picker and the
                          label association for nothing, and none of that is
                          worth rebuilding for a chevron.
                        */}
                        <span className="truncate text-sm font-semibold text-bakery-700">
                          {activeBand >= 0
                            ? priceBands[activeBand].label
                            : `All ${labels.productWordPlural.toLowerCase()}`}
                        </span>
                      </span>
                      <ChevronDown
                        aria-hidden="true"
                        className="ml-auto size-4 shrink-0 text-muted-foreground"
                      />
                      <select
                        value={activeBand}
                        onChange={(event) => {
                          const index = Number(event.target.value);
                          const band = priceBands[index];
                          updateFilters({
                            ...filters,
                            priceMin: band ? band.min : 0,
                            priceMax: band ? band.max : priceCeiling,
                          });
                        }}
                        className="absolute inset-0 size-full cursor-pointer opacity-0"
                      >
                        <option value={-1}>All {labels.productWordPlural.toLowerCase()}</option>
                        {priceBands.map((band, index) => (
                          <option key={band.label} value={index}>
                            {band.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <label className="relative flex min-w-0 flex-1 items-center gap-2 px-3 py-2 sm:flex-none sm:px-4">
                    <ArrowDownUp
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[11px] leading-tight font-medium text-muted-foreground">
                        Sort by
                      </span>
                      <span className="truncate text-sm font-semibold text-bakery-700">
                        {SORT_LABELS[filters.sort]}
                      </span>
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className="ml-auto size-4 shrink-0 text-muted-foreground"
                    />
                    <select
                      value={filters.sort}
                      onChange={(event) =>
                        updateFilters({
                          ...filters,
                          sort: event.target.value as CollectionFilters["sort"],
                        })
                      }
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                    >
                      {/* The word is the label above now — "Sort: Popular"
                          inside a cell headed "Sort by" said it twice. */}
                      {(Object.keys(SORT_LABELS) as CollectionFilters["sort"][]).map((key) => (
                        <option key={key} value={key}>
                          {SORT_LABELS[key]}
                        </option>
                      ))}
                    </select>
                  </label>

                </div>
              </div>

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
                  /*
                    TWO ON A PHONE, FOUR AT xl.

                    One column at 390 put ZERO cards fully on the first screen
                    — the card is ~430px tall and the header takes 64. Two
                    173px cards is the whole reason the grid changed at the
                    bottom end, and the sidebar leaving is the reason it can
                    change at the top.

                    FOUR AT xl AND NOT AT lg, deliberately. A 1440 window at
                    200% browser zoom reports a 720px viewport, which lands on
                    `md` — two readable columns — instead of four 180px ones.
                    No zoom media query can do that; the breakpoint choice is
                    the whole mechanism.
                  */
                  className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:gap-5 xl:grid-cols-4"
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
                    {/*
                      SEVEN SLOTS, NOT ONE PER PAGE.

                      `Array.from({ length: totalPages })` draws every page.
                      At 24 a page that is fine at 27 products and is 125
                      anchors wrapping five lines at 3,000 — which is the size
                      this software is sold to run, and the owner's correction
                      was not to size this page to today's catalogue.

                      First and last always, the current page with a neighbour
                      either side, and an ellipsis where the run breaks.
                    */}
                    {pageWindow.map((slot, index) =>
                      slot === null ? (
                        <PaginationItem key={`gap-${index}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={slot}>
                          <PaginationLink
                            href="#"
                            isActive={currentPage === slot}
                            onClick={(event) => {
                              event.preventDefault();
                              setPage(slot);
                            }}
                          >
                            {slot}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
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

              {/*
                THE SIBLING CATEGORIES, UNDER THE GRID.

                They were a row of eight pills above it, which is what the
                shop was looking at when they said the page does not look
                like the reference — and the reference has none, because its
                categories live in the header menu. Ours live there too now.

                NOT DELETED, though. `collections.spec.ts` asserts this
                navigation is visible with one link per real shop category and
                no duplicate hrefs, and it is a real way around for somebody
                who has reached the end of a category and wants the next one.
                Moving it answers the complaint; deleting it would turn a
                working test red for nothing.
              */}
              <nav aria-label="Categories" className="mt-12 flex flex-wrap gap-2 border-t border-border pt-6">
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
        /*
          `min-h-11` rather than `py-1.5`: the row measured 30px, and these
          are links a thumb aims at on a phone.

          `text-primary-foreground` rather than a welded `text-white`:
          `--primary-foreground` is `readableInkOn(primaryColor)`, so the ink
          is contrast-checked against whatever brand colour the shop picks.
          White on a pale brand is the failure this token exists to stop.
        */
        "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-premium",
        active
          ? "border-bakery-700 bg-bakery-700 text-primary-foreground shadow-sm"
          : "border-border bg-card text-muted-foreground hover:border-bakery-300 hover:text-bakery-700"
      )}
    >
      {label}
    </Link>
  );
}
