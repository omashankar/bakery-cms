import type { Product, StockStatus } from "@/types/product";
import type {
  InventoryItem,
  InventoryOverview,
  InventorySettings,
  StockAdjustmentType,
  StockHistoryEntry,
  StockHistoryReason,
} from "@/types/inventory";
import {
  getProductById,
  loadProducts,
  updateProduct,
} from "@/features/products/lib/products-repository";
import { adminCategories } from "@/features/products/lib/catalog-options";
import {
  deriveStockStatus,
  getLowStockThreshold,
  resolveStockFields,
} from "./inventory-utils";
import {
  adjustStockRequest,
  setUnlimitedRequest,
  saveInventorySettingsRequest,
} from "./inventory-api";

export {
  deriveStockStatus,
  formatStockStatusLabel,
  getStockStatusVariant,
  resolveStockFields,
} from "./inventory-utils";

const SETTINGS_KEY = "bakery-cms-inventory-settings";
const HISTORY_KEY = "bakery-cms-inventory-history";
const MAX_HISTORY = 200;

export const INVENTORY_UPDATED_EVENT = "bakery-inventory-updated";

export const defaultInventorySettings: InventorySettings = {
  defaultLowStockThreshold: 10,
  trackStockHistory: true,
};

function nowIso(): string {
  return new Date().toISOString();
}

function emitInventoryUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(INVENTORY_UPDATED_EVENT));
}

export function getInventorySettings(): InventorySettings {
  if (typeof window === "undefined") return defaultInventorySettings;

  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultInventorySettings;
    const parsed = JSON.parse(raw) as Partial<InventorySettings>;
    return {
      ...defaultInventorySettings,
      ...parsed,
    };
  } catch {
    return defaultInventorySettings;
  }
}

export async function saveInventorySettings(
  settings: InventorySettings
): Promise<{ settings: InventorySettings; persisted: boolean }> {
  if (typeof window === "undefined") return { settings, persisted: false };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  const persisted = await saveInventorySettingsRequest(settings);
  emitInventoryUpdated();
  return { settings, persisted };
}

/**
 * Hydration helpers — write server data into the local cache WITHOUT pushing it
 * back to the server (avoids a sync loop). Emit the update event so the admin UI
 * refreshes. Used by useInventoryServerSync.
 */
export function persistServerHistory(entries: StockHistoryEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
  emitInventoryUpdated();
}

export function persistServerSettings(settings: InventorySettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  emitInventoryUpdated();
}

export function loadStockHistory(cakeId?: string): StockHistoryEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StockHistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    const sorted = [...parsed].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return cakeId ? sorted.filter((entry) => entry.cakeId === cakeId) : sorted;
  } catch {
    return [];
  }
}

function appendStockHistory(entry: StockHistoryEntry): void {
  if (typeof window === "undefined") return;
  const settings = getInventorySettings();
  if (!settings.trackStockHistory) return;

  const history = loadStockHistory();
  const next = [entry, ...history].slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export function getInventoryItems(): InventoryItem[] {
  const categories = adminCategories();

  return loadProducts().map((cake) => {
    const stockStatus = deriveStockStatus(cake, getInventorySettings());
    const categoryName =
      categories.find((category) => category.id === cake.categoryId)?.name ?? "—";

    return {
      cakeId: cake.id,
      name: cake.name,
      slug: cake.slug,
      categoryName,
      image: cake.images[0],
      status: cake.status,
      stockStatus,
      stockQuantity: cake.stockQuantity,
      unlimitedStock: cake.unlimitedStock ?? false,
      lowStockThreshold: getLowStockThreshold(cake, getInventorySettings()),
      updatedAt: cake.updatedAt,
    };
  });
}

export function getInventoryOverview(): InventoryOverview {
  const items = getInventoryItems();

  const inStock = items.filter(
    (item) => !item.unlimitedStock && item.stockStatus === "in_stock"
  ).length;
  const lowStock = items.filter((item) => item.stockStatus === "low_stock").length;
  const outOfStock = items.filter((item) => item.stockStatus === "out_of_stock").length;
  const unlimited = items.filter((item) => item.unlimitedStock).length;

  return {
    totalSkus: items.length,
    inStock,
    lowStock,
    outOfStock,
    unlimited,
    alertCount: lowStock + outOfStock,
    totalUnits: items.reduce(
      (sum, item) => sum + (item.unlimitedStock ? 0 : item.stockQuantity),
      0
    ),
  };
}

export function countInventoryAlerts(): number {
  return getInventoryOverview().alertCount;
}

export interface AdjustStockInput {
  cakeId: string;
  type: StockAdjustmentType;
  quantity: number;
  reason?: StockHistoryReason;
  note?: string;
}

/**
 * An inventory write, plus whether the SERVER took it.
 *
 * Stock is the number the storefront sells against, and it lives in Mongo. A
 * local-only adjustment means the admin sees the count they set while the shop
 * keeps selling against the old one — it oversells, and the next hydration
 * silently reverts their change. So callers must not report success on `item`.
 */
export interface InventoryWriteResult {
  item: InventoryItem | null;
  persisted: boolean;
}

export async function adjustStock({
  cakeId,
  type,
  quantity,
  reason = "manual_adjustment",
  note,
}: AdjustStockInput): Promise<InventoryWriteResult> {
  const cake = getProductById(cakeId);
  if (!cake) return { item: null, persisted: false };

  const quantityBefore = cake.stockQuantity;
  let quantityAfter = quantityBefore;

  if (type === "add") {
    quantityAfter = quantityBefore + Math.max(quantity, 0);
  } else if (type === "remove") {
    quantityAfter = Math.max(quantityBefore - Math.max(quantity, 0), 0);
  } else {
    quantityAfter = Math.max(quantity, 0);
  }

  const stockFields = resolveStockFields({
    ...cake,
    stockQuantity: quantityAfter,
    unlimitedStock: false,
  });

  const updated = updateProduct(cakeId, {
    ...cake,
    ...stockFields,
  });

  if (!updated) return { item: null, persisted: false };

  appendStockHistory({
    id: `stock-${Date.now()}`,
    cakeId: cake.id,
    cakeName: cake.name,
    adjustmentType: type,
    quantityBefore,
    quantityChange: quantityAfter - quantityBefore,
    quantityAfter,
    reason,
    note,
    createdAt: nowIso(),
  });

  // Durable write to the server (updates the Mongo product stock + history).
  const persisted = await adjustStockRequest({ cakeId, type, quantity, reason, note });

  emitInventoryUpdated();
  return {
    item: getInventoryItems().find((item) => item.cakeId === cakeId) ?? null,
    persisted,
  };
}

export async function setUnlimitedStock(
  cakeId: string,
  unlimited: boolean
): Promise<InventoryWriteResult> {
  const cake = getProductById(cakeId);
  if (!cake) return { item: null, persisted: false };

  const stockFields = resolveStockFields({
    ...cake,
    unlimitedStock: unlimited,
  });

  updateProduct(cakeId, {
    ...cake,
    ...stockFields,
  });

  const persisted = await setUnlimitedRequest(cakeId, unlimited);

  emitInventoryUpdated();
  return {
    item: getInventoryItems().find((item) => item.cakeId === cakeId) ?? null,
    persisted,
  };
}

export type InventoryStockFilter = "all" | StockStatus | "unlimited";

export interface InventoryListFilters {
  search: string;
  stock: InventoryStockFilter;
  status: "all" | Product["status"];
}

export const defaultInventoryFilters: InventoryListFilters = {
  search: "",
  stock: "all",
  status: "all",
};

export function filterInventoryItems(
  items: InventoryItem[],
  filters: InventoryListFilters
): InventoryItem[] {
  const query = filters.search.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.stock === "unlimited") return item.unlimitedStock;
    if (filters.stock !== "all") {
      if (item.unlimitedStock) return false;
      if (item.stockStatus !== filters.stock) return false;
    }

    if (!query) return true;
    const haystack = `${item.name} ${item.slug} ${item.categoryName}`.toLowerCase();
    return haystack.includes(query);
  });
}

export function countActiveInventoryFilters(filters: InventoryListFilters): number {
  let count = 0;
  if (filters.stock !== "all") count += 1;
  if (filters.status !== "all") count += 1;
  return count;
}

export function formatStockHistoryReason(reason: StockHistoryReason): string {
  const labels: Record<StockHistoryReason, string> = {
    manual_adjustment: "Manual adjustment",
    restock: "Restock",
    correction: "Correction",
    sale: "Sale",
    return: "Return",
  };
  return labels[reason];
}
