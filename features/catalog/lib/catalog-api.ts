/**
 * Client-side catalog API. Best-effort: returns null / false on failure so the
 * existing localStorage flow keeps working if the server is unreachable or the
 * visitor is unauthenticated (backward compatibility during migration).
 */
import type { CatalogStore } from "@/types/catalog";
import { createHydrationGate } from "@/lib/hydration-gate";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

/** Sections the server accepts. */
export const CATALOG_SECTIONS = ["categories", "flavours", "occasions", "weights"] as const;

/** Full catalog (public — no auth needed). */
export async function fetchCatalog(): Promise<Partial<CatalogStore> | null> {
  try {
    const res = await fetch("/api/catalog", { headers: { Accept: "application/json" } });
    if (!res.ok) {
      noteAuthStatus(res.status);
      return null;
    }
    const json = (await res.json()) as Envelope<Partial<CatalogStore>>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/** Settled by `CatalogServerSync` once the server's taxonomy is loaded. */
export const catalogHydration = createHydrationGate();

export const CATALOG_HYDRATION_EVENT = "bakery-catalog-hydration";

/**
 * Whether this browser's taxonomy can be trusted yet.
 *
 * The gate alone answers "may I write", which is not enough for a screen: while
 * it is "pending" the Catalog page is rendering the shipped defaults, and while
 * it is "unavailable" it is rendering them with no prospect of correction. The
 * page said nothing in either case — every row looked like the shop's own
 * taxonomy and every button looked live.
 */
export type CatalogHydrationStatus = "pending" | "ready" | "unavailable";

let hydrationStatus: CatalogHydrationStatus = "pending";

export function catalogHydrationStatus(): CatalogHydrationStatus {
  return hydrationStatus;
}

export function setCatalogHydrationStatus(next: CatalogHydrationStatus): void {
  hydrationStatus = next;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CATALOG_HYDRATION_EVENT));
  }
}

/**
 * Reset one section to the shipped defaults, on the SERVER.
 *
 * The screen used to reset by PUTting the client's own defaults, which produced
 * the same rows but recorded the change as an ordinary edit. This endpoint knows
 * it is a reset and writes `catalog.reset.<section>` to the audit log, so the
 * one action that discards a shop's whole taxonomy is the one action that leaves
 * a trace.
 *
 * Waits for hydration for the same reason a push does — a reset the server never
 * saw would be undone by the next sync, silently.
 */
export async function resetCatalogSection(section: string): Promise<boolean> {
  if (!(await catalogHydration.waitForSettled())) return false;

  try {
    const res = await fetch(`/api/catalog/${section}/reset`, { method: "POST" });
    noteAuthStatus(res.status);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Push one section, whole. Never throws.
 *
 * Waits for hydration first: each section is a replace-all, so sending before
 * the server's copy has been read would overwrite the real taxonomy with
 * whatever this browser held — the demo seed on a fresh one.
 */
export async function pushCatalogSection(section: string, value: unknown): Promise<boolean> {
  if (!(await catalogHydration.waitForSettled())) return false;

  try {
    const res = await fetch(`/api/catalog/${section}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    noteAuthStatus(res.status);
    return res.ok;
  } catch {
    return false;
  }
}
