/**
 * Client-side inventory API. Best-effort: adjustments/settings dual-write to the
 * server; history/settings hydrate from it. Returns null on failure so the
 * existing localStorage flow keeps working when offline/unauthenticated.
 */
import type { InventorySettings, StockHistoryEntry } from "@/types/inventory";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
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
    if (!res.ok) return null;
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

/** Fire-and-forget stock adjustment to the server (never throws). */
export function adjustStockRequest(input: AdjustStockRequest): void {
  void post("/api/inventory/adjust", input);
}

export function setUnlimitedRequest(cakeId: string, unlimited: boolean): void {
  void post("/api/inventory/unlimited", { cakeId, unlimited });
}

export function fetchStockHistory(): Promise<StockHistoryEntry[] | null> {
  return getJson<StockHistoryEntry[]>("/api/inventory/history");
}

export function fetchInventorySettings(): Promise<InventorySettings | null> {
  return getJson<InventorySettings>("/api/inventory/settings");
}

export function saveInventorySettingsRequest(settings: InventorySettings): void {
  void post("/api/inventory/settings", settings, "PUT");
}
