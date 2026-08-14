/**
 * Client-side inventory API. Best-effort: adjustments/settings dual-write to the
 * server; history/settings hydrate from it. Returns null on failure so the
 * existing localStorage flow keeps working when offline/unauthenticated.
 */
import { createHydrationGate } from "@/lib/hydration-gate";
import type { InventoryOverview, InventorySettings, StockHistoryEntry } from "@/types/inventory";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

/**
 * Opened once the SERVER's inventory settings have been read locally.
 *
 * `saveInventorySettingsRequest` is a whole-document PUT — low-stock threshold,
 * out-of-stock behaviour, the alert switches — and it was the only replace-all
 * writer in the codebase with no gate at all. So a browser whose read failed
 * held the defaults and one save replaced the shop's thresholds with them,
 * which is the kind of change nobody notices until the alerts stop arriving.
 */
export const inventoryHydration = createHydrationGate();

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      noteAuthStatus(res.status);
      return null;
    }
    const json = (await res.json()) as Envelope<T>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

async function post<T>(path: string, body: unknown, method = "POST"): Promise<T | null> {
  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      noteAuthStatus(res.status);
      return null;
    }
    const json = (await res.json()) as Envelope<T>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export interface AdjustStockRequest {
  cakeId: string;
  type: "add" | "remove" | "set";
  quantity: number;
  reason?: StockHistoryEntry["reason"];
  note?: string;
}

/**
 * Whether the SERVER accepted the write. Never throws.
 *
 * These used to be fire-and-forget, which for stock means the admin is told a
 * count changed while Mongo — the number the storefront actually sells against —
 * still holds the old one. That gap oversells: the shop keeps taking orders for
 * a cake it no longer has.
 */
async function wrote(path: string, body: unknown, method = "POST"): Promise<boolean> {
  return (await post(path, body, method)) !== null;
}

/** What the server says the product's stock IS, after the adjustment. */
export interface AdjustStockResult {
  cakeId: string;
  stockQuantity: number;
  unlimitedStock: boolean;
  stockStatus: string;
  updatedAt?: string;
}

/**
 * Apply an adjustment and take the server's number back.
 *
 * This returned a bare boolean and the caller displayed the figure it had
 * computed locally. Those disagree the moment anything else touches the row — an
 * order, or a second admin adjusting the same cake — and the number on screen
 * was then one that exists nowhere. Null means the server refused; the caller
 * must not write anything.
 */
export function adjustStockRequest(
  input: AdjustStockRequest
): Promise<AdjustStockResult | null> {
  return post<AdjustStockResult>("/api/inventory/adjust", input);
}

export function setUnlimitedRequest(cakeId: string, unlimited: boolean): Promise<boolean> {
  return wrote("/api/inventory/unlimited", { cakeId, unlimited });
}

/**
 * The stat cards, computed on the server over every product.
 *
 * The screen derived them from this browser's product cache instead, while this
 * endpoint sat unused. That cache is a copy — a stale one on any tab open while
 * another admin was working — and it is the numbers on those cards that decide
 * whether anyone goes and bakes more.
 */
export function fetchInventoryOverview(): Promise<InventoryOverview | null> {
  return getJson<InventoryOverview>("/api/inventory/overview");
}

export function fetchStockHistory(): Promise<StockHistoryEntry[] | null> {
  return getJson<StockHistoryEntry[]>("/api/inventory/history");
}

export function fetchInventorySettings(): Promise<InventorySettings | null> {
  return getJson<InventorySettings>("/api/inventory/settings");
}

export async function saveInventorySettingsRequest(
  settings: InventorySettings,
): Promise<boolean> {
  // Refuse to send a copy this browser cannot vouch for. Reporting `false`
  // surfaces as "saved on this device only" and keeps Save live for a retry —
  // better than replacing the shop's thresholds with these defaults and
  // reporting success.
  if (!(await inventoryHydration.waitForSettled())) return false;
  return wrote("/api/inventory/settings", settings, "PUT");
}
