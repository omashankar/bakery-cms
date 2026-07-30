/**
 * Client-side catalog API. Best-effort: returns null / false on failure so the
 * existing localStorage flow keeps working if the server is unreachable or the
 * visitor is unauthenticated (backward compatibility during migration).
 */
import type { CatalogStore } from "@/types/catalog";
import { createHydrationGate } from "@/lib/hydration-gate";

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
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<Partial<CatalogStore>>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/** Settled by `CatalogServerSync` once the server's taxonomy is loaded. */
export const catalogHydration = createHydrationGate();

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
    return res.ok;
  } catch {
    return false;
  }
}
