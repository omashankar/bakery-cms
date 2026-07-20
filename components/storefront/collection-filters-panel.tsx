"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  COLLECTION_PRICE_MAX,
  DEFAULT_COLLECTION_FILTERS,
  type CollectionFilters,
  getFilterFlavourOptions,
  getFilterOccasionOptions,
  getFilterWeightOptions,
} from "@/apps/website/lib/collection-filters";
import { cn } from "@/lib/utils";

interface CollectionFiltersPanelProps {
  filters: CollectionFilters;
  onChange: (filters: CollectionFilters) => void;
  className?: string;
}

export function CollectionFiltersPanel({
  filters,
  onChange,
  className,
}: CollectionFiltersPanelProps) {
  const occasions = getFilterOccasionOptions();
  const flavours = getFilterFlavourOptions();
  const weights = getFilterWeightOptions();

  const toggleListValue = (key: "occasions" | "flavours" | "weights", value: string) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  };

  return (
    <aside className={cn("space-y-6 rounded-xl border border-border bg-card p-5", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="size-4 text-bakery-700" />
          <h2 className="font-heading text-base font-semibold">Filters</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange({ ...DEFAULT_COLLECTION_FILTERS, search: filters.search, sort: filters.sort })}
        >
          Clear
        </Button>
      </div>

      <FilterGroup title="Occasion">
        {occasions.map((occasion) => (
          <FilterCheckbox
            key={occasion}
            id={`occasion-${occasion}`}
            label={occasion}
            checked={filters.occasions.includes(occasion)}
            onCheckedChange={() => toggleListValue("occasions", occasion)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Flavour">
        {flavours.map((flavour) => (
          <FilterCheckbox
            key={flavour}
            id={`flavour-${flavour}`}
            label={flavour}
            checked={filters.flavours.includes(flavour)}
            onCheckedChange={() => toggleListValue("flavours", flavour)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Weight">
        {weights.map((weight) => (
          <FilterCheckbox
            key={weight}
            id={`weight-${weight}`}
            label={weight}
            checked={filters.weights.includes(weight)}
            onCheckedChange={() => toggleListValue("weights", weight)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Price range">
        <div className="space-y-3">
          <input
            type="range"
            aria-label="Maximum price"
            min={0}
            max={COLLECTION_PRICE_MAX}
            step={100}
            value={filters.priceMax}
            onChange={(event) =>
              onChange({ ...filters, priceMax: Number(event.target.value) })
            }
            className="w-full accent-bakery-700"
          />
          <p className="text-sm text-muted-foreground">
            Up to ₹{filters.priceMax.toLocaleString("en-IN")}
          </p>
        </div>
      </FilterGroup>

      <FilterGroup title="Preferences">
        <FilterCheckbox
          id="eggless-only"
          label="Eggless only"
          checked={filters.egglessOnly}
          onCheckedChange={(checked) => onChange({ ...filters, egglessOnly: checked })}
        />
        <FilterCheckbox
          id="in-stock-only"
          label="In stock only"
          checked={filters.inStockOnly}
          onCheckedChange={(checked) => onChange({ ...filters, inStockOnly: checked })}
        />
      </FilterGroup>
    </aside>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 border-t border-border pt-4 first:border-t-0 first:pt-0">
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
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
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
