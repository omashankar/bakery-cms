"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { INDIAN_STATES } from "@/features/commerce/lib/india-states";
import { cn } from "@/lib/utils";
import type { DistrictEntry } from "@/types/delivery";

/**
 * WHOLE DISTRICTS OR WHOLE STATES, picked from India Post's own lists.
 *
 * Picked, not typed freely: a zone matches the district the SERVER finds the
 * customer's map pin in, spelled as India Post spells it — "Kotah" would match
 * nobody. A district that is in two states (Bilaspur, Aurangabad) is chosen
 * by name and covers both; the list shows the state beside it.
 */
export function ZoneRegionPicker({
  kind,
  districts,
  states,
  districtList,
  onChange,
}: {
  kind: "cities" | "states";
  districts: string[];
  states: string[];
  /** India Post's districts, null while loading. */
  districtList: DistrictEntry[] | null;
  onChange: (patch: { districts?: string[]; states?: string[] }) => void;
}) {
  const [pick, setPick] = useState("");
  const [stateQuery, setStateQuery] = useState("");

  if (kind === "cities") {
    const add = () => {
      const typed = pick.trim().toLowerCase();
      const found = districtList?.find((entry) => entry.name.toLowerCase() === typed)?.name ?? pick.trim();
      if (found && !districts.some((name) => name.toLowerCase() === found.toLowerCase())) onChange({ districts: [...districts, found] });
      setPick("");
    };
    return (
      <div className="space-y-2">
        <Label htmlFor="zone-district-pick">Districts</Label>
        <div className="flex gap-2">
          <Input
            id="zone-district-pick"
            list="zone-district-options"
            value={pick}
            onChange={(event) => setPick(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
            placeholder={districtList ? "Type a district — Kota, Bundi…" : "Loading districts…"}
          />
          <Button type="button" variant="outline" disabled={!pick.trim()} onClick={add}>
            Add
          </Button>
          <datalist id="zone-district-options">
            {(districtList ?? []).map((entry) => (
              <option key={`${entry.name}|${entry.state}`} value={entry.name}>
                {entry.state}
              </option>
            ))}
          </datalist>
        </div>
        {districts.length ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="Districts in this zone">
            {districts.map((name) => {
              const states = (districtList ?? []).filter((entry) => entry.name.toLowerCase() === name.toLowerCase()).map((entry) => entry.state);
              return (
                <li
                  key={name}
                  className={cn(
                    "flex items-center gap-1 rounded-md border py-0.5 pr-1 pl-2 text-xs",
                    // Red once the list is in and has no such district: no pin would ever match it.
                    districtList && !states.length ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-border bg-muted/60",
                  )}
                >
                  <span className="font-medium">{name}</span>
                  {states.length ? (
                    <span className="text-muted-foreground">· {states.join(" / ")}</span>
                  ) : districtList ? (
                    <span>· not a district</span>
                  ) : null}
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() => onChange({ districts: districts.filter((entry) => entry !== name) })}
                    className="rounded p-0.5 hover:bg-background"
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Every address whose map pin is in these districts — the whole district, its villages too, not just
          the city. For the city alone, use <strong>On the map</strong> and draw a circle or boundary
          instead. A circle or boundary inside a district still wins where it applies, so a cheaper rate for
          the town and this rate for the rest of the district works.
        </p>
      </div>
    );
  }

  const visible = INDIAN_STATES.filter((state) => state.toLowerCase().includes(stateQuery.trim().toLowerCase()));
  return (
    <div className="space-y-2">
      <Label htmlFor="zone-state-search">States</Label>
      <Input id="zone-state-search" value={stateQuery} onChange={(event) => setStateQuery(event.target.value)} placeholder="Search states" />
      {/* The cap is on this wrapper, not the grid: a height-capped grid shares the height out instead of scrolling. */}
      <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {visible.map((state) => (
            <label key={state} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
              <Checkbox
                checked={states.includes(state)}
                onCheckedChange={(next) =>
                  onChange({ states: next === true ? [...states, state] : states.filter((entry) => entry !== state) })
                }
              />
              {state}
            </label>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {states.length ? `${states.length} chosen. ` : ""}Every address whose map pin is in these states. Any district,
        circle or boundary inside still wins where it applies.
      </p>
    </div>
  );
}
