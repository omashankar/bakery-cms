"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import type { LatLng } from "@/types/delivery";

/**
 * "FIND A PLACE" — suggestions from OpenStreetMap as the person types.
 *
 * One box for both maps: the customer finding their street at checkout, and
 * the owner finding their shop when drawing a delivery zone. Asked through the
 * shop's own server (/api/checkout/address-search), which caches and limits
 * the calls. A suggestion only moves a map; it proves nothing about an address.
 */

export interface PlaceSuggestion {
  label: string;
  postalCode?: string;
  /** The neighbourhood — "Borkhera". */
  area?: string;
  city?: string;
  state?: string;
  location: LatLng;
  /** How close to show it: a street at 17, a town at 12, a state at 7. */
  zoom?: number;
}

/**
 * Ever-shorter forms of a written address, for a search that found nothing:
 * "Santosh Nagar - 1, C-7, I, Borkhera, Kota, Rajasthan 324002" is not a
 * place OpenStreetMap knows, "Borkhera, Kota, Rajasthan" is. The front of an
 * address is the house and lane; the back is the area and town.
 */
export function placeQueries(address: string, max = 4): string[] {
  const parts = address
    .split(",")
    .map((part) => part.replace(/\b\d{6}\b/g, "").trim())
    .filter(Boolean);
  const out = [address.trim()];
  for (let i = 1; i < parts.length - 1; i += 1) out.push(parts.slice(i).join(", "));
  return [...new Set(out)].filter(Boolean).slice(0, max);
}

const fold = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * The suggestion most like the written address: its PIN first, then how many
 * of the address's names it shares. "Borkhera, Kota, Rajasthan" names two
 * villages; the one in Kota shares "Kota", the one in Digod tehsil does not.
 */
export function bestPlaceFor(address: string, results: PlaceSuggestion[]): PlaceSuggestion | null {
  const pin = address.match(/\b[1-9]\d{5}\b/)?.[0];
  const names = address.split(",").map((part) => fold(part.replace(/\b\d{6}\b/g, ""))).filter((part) => part.length > 2);
  let best: PlaceSuggestion | null = null;
  let bestScore = -1;
  for (const place of results) {
    const label = ` ${fold(place.label)} `;
    const score = (pin && place.postalCode === pin ? 10 : 0) + names.filter((name) => label.includes(` ${name} `)).length;
    if (score > bestScore) {
      best = place;
      bestScore = score;
    }
  }
  return best;
}

/** The suggestion for a place most like it, or null — for opening a map somewhere sensible. */
export async function findPlace(query: string, near?: LatLng | null): Promise<PlaceSuggestion | null> {
  for (const attempt of placeQueries(query)) {
    const results = await askForPlaces(attempt, near);
    if (results.length) return bestPlaceFor(query, results);
  }
  return null;
}

/**
 * Places for what was typed, and whether search could be made at all.
 * `full` is a pressed Search: the shop also asks a second service, which
 * allows no search-as-you-type (see osm-search.server.ts).
 */
export async function searchPlaces(
  query: string,
  near?: LatLng | null,
  signal?: AbortSignal,
  full = false,
): Promise<{ results: PlaceSuggestion[]; unavailable: boolean }> {
  const bias = near ? `&lat=${near.lat}&lng=${near.lng}` : "";
  const res = await fetch(`/api/checkout/address-search?q=${encodeURIComponent(query)}${bias}${full ? "&full=1" : ""}`, { signal });
  const body = (await res.json().catch(() => null)) as { success?: boolean; data?: PlaceSuggestion[] } | null;
  if (res.ok && body?.success && Array.isArray(body.data)) return { results: body.data, unavailable: false };
  return { results: [], unavailable: res.status === 503 };
}

/** Suggestions for what was typed — the same list the box shows. Empty on any failure. */
export async function askForPlaces(query: string, near?: LatLng | null, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  return (await searchPlaces(query, near, signal)).results;
}

export function PlaceSearch({
  onPick,
  near,
  placeholder,
  className,
}: {
  onPick: (place: PlaceSuggestion) => void;
  /** Where to look first — the shop's area — so "bus stand" means the nearby one. */
  near?: LatLng | null;
  placeholder: string;
  className?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  // What the list on screen answers, and whether that was a pressed Search.
  const [answered, setAnswered] = useState<{ query: string; full: boolean } | null>(null);
  const [searching, setSearching] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(-1);
  // A picked suggestion fills the box with its label; that is not a new search.
  const picked = useRef(false);
  const fullSearch = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (picked.current) {
      picked.current = false;
      return;
    }
    if (q.length < 3) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      void searchPlaces(q, near, controller.signal)
        .then(({ results, unavailable: down }) => {
          setSuggestions(results);
          setAnswered({ query: q, full: false });
          setUnavailable(down);
          setActive(-1);
        })
        .catch(() => undefined)
        .finally(() => setSearching(false));
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // Only what is typed asks; `near` merely nudges the answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  /**
   * "Search for …", pressed: the shop asks a second service too — the one
   * that knows Hindi names (जयपुर, कनॉट प्लेस) and some places the
   * suggestions miss. Never per keystroke: its rules forbid that.
   */
  function searchEverywhere() {
    const q = query.trim();
    if (q.length < 3) return;
    fullSearch.current?.abort();
    const controller = new AbortController();
    fullSearch.current = controller;
    setSearching(true);
    setListOpen(true);
    void searchPlaces(q, near, controller.signal, true)
      .then(({ results, unavailable: down }) => {
        setSuggestions(results);
        setAnswered({ query: q, full: true });
        setUnavailable(down);
        setActive(results.length ? 0 : -1);
      })
      .catch(() => undefined)
      .finally(() => setSearching(false));
  }

  function choose(place: PlaceSuggestion) {
    picked.current = true;
    setQuery(place.label);
    setSuggestions([]);
    setListOpen(false);
    onPick(place);
  }

  const q = query.trim();
  const current = answered?.query === q;
  // The last row offers a wider search, until one has been made for these words.
  const canSearchMore = q.length >= 3 && !(current && answered?.full) && !unavailable;
  const nothingFound = current && answered?.full && suggestions.length === 0;
  const rows = suggestions.length + (canSearchMore ? 1 : 0);
  const open = listOpen && q.length >= 3 && current && (rows > 0 || Boolean(nothingFound));

  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={placeholder}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setListOpen(true);
        }}
        onFocus={() => setListOpen(true)}
        // A choice is made on mousedown, before this — so leaving the box only closes the list.
        onBlur={() => setListOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            // Inside a form: Enter picks or searches, it never submits the form.
            if (q.length >= 3) event.preventDefault();
            if (open && active >= 0 && active < suggestions.length) choose(suggestions[active]);
            else if (q.length >= 3) searchEverywhere();
            return;
          }
          if (!open) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((i) => Math.min(i + 1, rows - 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (event.key === "Escape") {
            setListOpen(false);
          }
        }}
        placeholder={placeholder}
        className="h-11 w-full rounded-md border border-input bg-card pr-9 pl-9 text-base outline-none focus:border-ring focus:ring-3 focus:ring-ring/50 md:text-sm"
      />
      {searching ? (
        <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
      ) : null}
      {open ? (
        <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-popover py-1 text-sm shadow-lg">
          {suggestions.map((place, i) => (
            <li
              key={`${place.label}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(place);
              }}
              className={cn("cursor-pointer px-3 py-2", i === active ? "bg-muted" : "hover:bg-muted/60")}
            >
              {place.label}
            </li>
          ))}
          {canSearchMore ? (
            <li
              role="option"
              aria-selected={active === suggestions.length}
              onMouseDown={(event) => {
                event.preventDefault();
                searchEverywhere();
              }}
              className={cn(
                "flex cursor-pointer items-center gap-2 border-t border-border px-3 py-2 font-medium text-bakery-700",
                active === suggestions.length ? "bg-muted" : "hover:bg-muted/60",
              )}
            >
              <Search className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 truncate">
                {suggestions.length ? "Not here? " : ""}Search for &ldquo;{q}&rdquo;
              </span>
            </li>
          ) : null}
          {nothingFound ? (
            <li className="px-3 py-2 text-muted-foreground">
              No place found for &ldquo;{q}&rdquo;. Try your area&apos;s name, a landmark nearby, or your PIN code.
            </li>
          ) : null}
        </ul>
      ) : null}
      {unavailable && current ? (
        <p role="alert" className="mt-1.5 text-xs text-amber-700 dark:text-amber-300">
          Address search isn&apos;t working right now. Drag the pin, tap the map, or use your current location instead.
        </p>
      ) : null}
    </div>
  );
}
