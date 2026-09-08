"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  COLLECTION_PRICE_FLOOR,
  defaultCollectionFilters,
  DEFAULT_FILTER_OCCASION_OPTIONS,
  optionFacetKey,
  tickedOptions,
  type CollectionFilterFacet,
  type CollectionFilters,
  getFilterOccasionOptions,
} from "@/apps/website/lib/collection-filters";
import { formatCurrency } from "@/utils/format";
import { DEFAULT_SIZE_AXIS_LABEL } from "@/features/products/lib/product-pricing";
import type { ModuleSettings } from "@/types/settings";
import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import {
  getModuleSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { cn } from "@/lib/utils";

interface CollectionFiltersPanelProps {
  filters: CollectionFilters;
  onChange: (filters: CollectionFilters) => void;
  /**
   * The dearest thing the shop sells, rounded up. The slider must reach it —
   * a fixed ceiling hid every product above itself with no way to get them back.
   */
  priceCeiling?: number;
  /**
   * The sizes to offer, read off the products being filtered.
   *
   * Passed in rather than looked up, because only the page knows what it is
   * showing. The panel used to ask a shop-wide list, which could offer a size
   * nothing on the page is sold in — a tick that hides everything.
   */
  sizeOptions?: string[];
  /**
   * The flavours to offer, read off the products being filtered.
   *
   * Passed in for the same reason sizes are: this was a shop-wide list, and a
   * list nobody keeps in step offers ticks that match nothing.
   *
   * The LEGACY list only now — the comma-separated box on the product form.
   * Variant options are `optionFacets` below, each under its own heading.
   */
  flavourOptions?: string[];
  /**
   * One box per question the shop's products ask, in the shop's own words.
   *
   * This panel used to print `<FilterGroup title="Flavour">` and pour every
   * option label in the catalogue into it — so a bakery got "Flavour: Regular,
   * Eggless, Round, Square, Heart" and a hardware shop would get "Flavour: 65W,
   * Type-C". Nothing here names a heading any more; they arrive with the data.
   */
  optionFacets?: CollectionFilterFacet[];
  /**
   * Distinguishes this panel's checkbox ids from the other one's.
   *
   * Collections mounts this TWICE — a sidebar that is `hidden lg:block` (still
   * in the document, still holding ids) and the mobile sheet. Two ids the same
   * and a `<Label htmlFor>` binds to whichever came first in the document, so a
   * tap on the phone toggles a checkbox nobody can see.
   *
   * Optional and defaulting to "", so a bare `<CollectionFiltersPanel filters
   * onChange />` still compiles.
   */
  idPrefix?: string;
  className?: string;
}

/** Show this many options before "Show all", so one long box cannot bury the rest. */
const VISIBLE_OPTIONS = 8;

export function CollectionFiltersPanel({
  filters,
  onChange,
  priceCeiling = COLLECTION_PRICE_FLOOR,
  sizeOptions = [],
  flavourOptions = [],
  optionFacets = [],
  idPrefix = "",
  className,
}: CollectionFiltersPanelProps) {
  const weights = sizeOptions;
  const flavours = flavourOptions;
  /**
   * Which boxes the customer asked to see in full.
   *
   * Panel-local, never in `CollectionFilters`: it is not a filter, and putting
   * it there would change the object identity the page's `setPage(1)` effect
   * watches every time somebody expanded a list.
   */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // Occasions still live in the catalog store (localStorage on the client).
  // Seed with the SAME defaults the server renders, then refresh after mount —
  // otherwise a customized catalog would mismatch the SSR HTML.
  const [occasions, setOccasions] = useState<string[]>(DEFAULT_FILTER_OCCASION_OPTIONS);
  // Flavour / weight / eggless filters are bakery modules — hide when off.
  // Default ON so SSR / bakery render exactly as before.
  const [modules, setModules] = useState<ModuleSettings>(defaultModuleSettings);
  useEffect(() => {
    const sync = () => {
      setModules(getModuleSettings());
      setOccasions(getFilterOccasionOptions());
    };
    sync();
    window.addEventListener(SETTINGS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, sync);
  }, []);

  const toggleListValue = (key: "occasions" | "flavours" | "weights", value: string) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  };

  /**
   * Rebuilt, never mutated — `DEFAULT_COLLECTION_FILTERS.options` is frozen and
   * shared by every caller that spreads it.
   *
   * An emptied box is DELETED rather than left as `key: []`. `countActiveFilters`
   * and the matcher both take "the key is here" to mean "something is ticked",
   * and a leftover empty array is a filter that reads as on and does nothing.
   */
  const toggleFacetValue = (key: string, label: string) => {
    const current = tickedOptions(filters, key);
    const next = current.some((item) => optionFacetKey(item) === optionFacetKey(label))
      ? current.filter((item) => optionFacetKey(item) !== optionFacetKey(label))
      : [...current, label];

    const options = { ...filters.options };
    if (next.length > 0) options[key] = next;
    else delete options[key];

    onChange({ ...filters, options });
  };

  return (
    <aside
      className={cn(
        "space-y-6 rounded-xl border border-border bg-card p-5",
        // Sticky desktop sidebar: if the filter list ever outgrows the viewport,
        // scroll inside the panel instead of clipping the last groups.
        "lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto panel-scroll",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-bakery-700" />
          <h2 className="font-heading text-base font-semibold">Filters</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() =>
            onChange({
              ...defaultCollectionFilters(priceCeiling),
              search: filters.search,
              sort: filters.sort,
            })
          }
        >
          Clear
        </Button>
      </div>

      <FilterGroup title="Occasion">
        {occasions.map((occasion) => (
          <FilterCheckbox
            key={occasion}
            id={`${idPrefix}occasion-${occasion}`}
            label={occasion}
            checked={filters.occasions.includes(occasion)}
            onCheckedChange={() => toggleListValue("occasions", occasion)}
          />
        ))}
      </FilterGroup>

      {/*
        The shop's own questions, each under its own name. No heading in this
        file, and no module read for them either: a shape group is dropped
        server-side inside `toCard`, so a box for a switched-off module is never
        BUILT rather than hidden — which also means the panel's localStorage copy
        of `modules` can never overrule what the database sent.
      */}
      {optionFacets.map((facet, facetIndex) => {
        const ticked = tickedOptions(filters, facet.key);
        const isOpen = expanded[facet.key] ?? false;
        /*
          Every ticked option stays visible however long the list. Collapsing one
          out of sight leaves a customer filtering by something they can see no
          way to switch off.
        */
        const shown = isOpen
          ? facet.options
          : facet.options.filter(
              (option, index) =>
                index < VISIBLE_OPTIONS ||
                ticked.some((item) => optionFacetKey(item) === optionFacetKey(option)),
            );

        return (
          <FilterGroup key={facet.key} title={facet.name} noDivider>
            {shown.map((option, optionIndex) => (
              <FilterCheckbox
                key={option}
                /*
                  Indexed, not built from the words. This shop carries "Regular"
                  and "Eggless" in TWO groups, so a label-keyed id collides inside
                  one panel — and `option-${name}-${label}` collides anyway, since
                  ("A B", "C") and ("A", "B-C") join to the same string.
                */
                id={`${idPrefix}opt-${facetIndex}-${optionIndex}`}
                label={option}
                checked={ticked.some((item) => optionFacetKey(item) === optionFacetKey(option))}
                onCheckedChange={() => toggleFacetValue(facet.key, option)}
                data-option-group={facet.name}
                data-option-label={option}
              />
            ))}
            {facet.options.length > shown.length || (isOpen && facet.options.length > VISIBLE_OPTIONS) ? (
              <button
                type="button"
                className="text-xs font-medium text-bakery-700 underline-offset-2 hover:underline"
                onClick={() => setExpanded((prev) => ({ ...prev, [facet.key]: !isOpen }))}
              >
                {isOpen ? "Show fewer" : `Show all ${facet.options.length}`}
              </button>
            ) : null}
          </FilterGroup>
        );
      })}

      {/*
        The LEGACY flavour box, and the only thing `modules.flavour` gates now.

        It used to gate the one box that held every variant option in the shop,
        so switching Flavour off took the Shape filter down with it. What is left
        under this switch is the comma-separated list on the product form — the
        one field the word was ever true of. Hidden entirely when empty, rather
        than printing a bare "FLAVOUR" heading over nothing, which is what a shop
        that never filled that box in would otherwise see.
      */}
      {modules.flavour && flavours.length > 0 ? (
        <FilterGroup title="Flavour" noDivider data-gate-flavour="">
          {flavours.map((flavour) => (
            <FilterCheckbox
              key={flavour}
              id={`${idPrefix}flavour-${flavour}`}
              label={flavour}
              checked={filters.flavours.includes(flavour)}
              onCheckedChange={() => toggleListValue("flavours", flavour)}
            />
          ))}
        </FilterGroup>
      ) : null}

      {/*
        The generic word. This filter spans the WHOLE catalogue, so it cannot
        take any one product’s ‘weightLabel’ — and over a mixed catalogue of
        cakes and shirts “Weight: S, M, L” is simply wrong. A shop-level name
        for this axis is a later step; the generic one is never wrong in the
        meantime.
      */}
      {modules.weight ? (
        <FilterGroup title={DEFAULT_SIZE_AXIS_LABEL} noDivider data-gate-weight="">
          {weights.map((weight) => (
            <FilterCheckbox
              key={weight}
              id={`${idPrefix}weight-${weight}`}
              label={weight}
              checked={filters.weights.includes(weight)}
              onCheckedChange={() => toggleListValue("weights", weight)}
            />
          ))}
        </FilterGroup>
      ) : null}

      <FilterGroup title="Price range">
        <div className="space-y-3">
          <input
            type="range"
            aria-label="Maximum price"
            min={0}
            max={priceCeiling}
            step={100}
            value={Math.min(filters.priceMax, priceCeiling)}
            onChange={(event) =>
              onChange({ ...filters, priceMax: Number(event.target.value) })
            }
            className="w-full accent-bakery-700"
          />
          <p className="text-sm text-muted-foreground">
            {/*
              The shop's currency, not a hardcoded rupee. A shop selling in
              dollars had its own prices formatted correctly everywhere else on
              the page and "₹" here alone.

              And at the top of the slider this says so in words: "Up to
              ₹19,000" beside a grid showing everything reads as a filter that
              is doing something, when it is not.
            */}
            {filters.priceMax >= priceCeiling
              ? "Any price"
              : `Up to ${formatCurrency(filters.priceMax)}`}
          </p>
        </div>
      </FilterGroup>

      <FilterGroup title="Preferences">
        <FilterCheckbox
          id={`${idPrefix}in-stock-only`}
          label="In stock only"
          checked={filters.inStockOnly}
          onCheckedChange={(checked) => onChange({ ...filters, inStockOnly: checked })}
        />
      </FilterGroup>
    </aside>
  );
}

function FilterGroup({
  title,
  children,
  noDivider,
  ...rest
}: {
  title: string;
  children: React.ReactNode;
  noDivider?: boolean;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "space-y-3",
        // Occasion → Flavour → Weight read as one cluster (no divider lines
        // between them, as in the original). The space-y-6 on the aside still
        // gives each a clean gap — that gap was the only thing missing before.
        !noDivider && "border-t border-border pt-4 first:border-t-0 first:pt-0"
      )}
      {...rest}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function FilterCheckbox({
  id,
  label,
  checked,
  onCheckedChange,
  ...rest
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="flex items-center gap-2" {...rest}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <Label htmlFor={id} className="text-sm font-normal">
        {label}
      </Label>
    </div>
  );
}
