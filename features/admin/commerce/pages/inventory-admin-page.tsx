"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Infinity as InfinityIcon,
  Package,
  PackageX,
  Pencil,
  Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/features/admin/cakes/components/admin-field";
import { StockStatusBadge } from "@/features/admin/commerce/components/stock-status-badge";
import { StockAdjustmentDialog } from "@/features/admin/commerce/components/stock-adjustment-dialog";
import {
  FilterPanel,
  FilterPanelSearch,
  FilterPanelToolbar,
} from "@/components/shared/filter-panel";
import { SafeImage } from "@/components/shared/safe-image";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { DashboardStatCard } from "@/features/admin/dashboard/components/dashboard-stat-card";
import { AdminPage, AdminPageHeader, adminShell } from "@/features/admin/components";
import {
  defaultInventoryFilters,
  defaultInventorySettings,
  filterInventoryItems,
  formatStockHistoryReason,
  getInventoryItems,
  getInventoryOverview,
  getInventorySettings,
  INVENTORY_UPDATED_EVENT,
  loadStockHistory,
  saveInventorySettings,
  setUnlimitedStock,
  type InventoryListFilters,
} from "@/features/admin/commerce/lib/inventory-repository";
import type { InventoryItem, InventoryOverview, InventorySettings } from "@/types/inventory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { routes } from "@/constants/routes";
import { formatRelativeTime } from "@/utils/format";

const PAGE_SIZE = 10;

const EMPTY_OVERVIEW: InventoryOverview = {
  totalSkus: 0,
  inStock: 0,
  lowStock: 0,
  outOfStock: 0,
  unlimited: 0,
  alertCount: 0,
  totalUnits: 0,
};

export function InventoryAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState<InventoryListFilters>(defaultInventoryFilters);
  const [page, setPage] = useState(1);
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null);
  const [settings, setSettings] = useState<InventorySettings>(defaultInventorySettings);
  const [savedSettings, setSavedSettings] = useState<InventorySettings>(defaultInventorySettings);

  const overview = useMemo(
    () => (mounted ? getInventoryOverview() : EMPTY_OVERVIEW),
    [mounted, refreshKey]
  );
  const items = useMemo(() => (mounted ? getInventoryItems() : []), [mounted, refreshKey]);
  const history = useMemo(
    () => (mounted ? loadStockHistory().slice(0, 8) : []),
    [mounted, refreshKey]
  );

  const filtered = useMemo(() => filterInventoryItems(items, filters), [items, filters]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const settingsDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  useEffect(() => {
    const loaded = getInventorySettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    setMounted(true);
    setRefreshKey(1);

    function onInventoryUpdated() {
      setRefreshKey((value) => value + 1);
    }

    window.addEventListener(INVENTORY_UPDATED_EVENT, onInventoryUpdated);
    return () => window.removeEventListener(INVENTORY_UPDATED_EVENT, onInventoryUpdated);
  }, []);

  function updateFilters(patch: Partial<InventoryListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function bump() {
    setRefreshKey((value) => value + 1);
  }

  function handleSaveSettings() {
    const saved = saveInventorySettings(settings);
    setSettings(saved);
    setSavedSettings(saved);
    toast.success("Inventory settings saved");
    bump();
  }

  function handleToggleUnlimited(item: InventoryItem) {
    const updated = setUnlimitedStock(item.cakeId, !item.unlimitedStock);
    if (!updated) return;
    toast.success(updated.unlimitedStock ? "Unlimited stock enabled" : "Unlimited stock disabled");
    bump();
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Inventory"
        description="Track stock levels and adjustments."
        className="gap-3"
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ stock: "low_stock" })}
        >
          <DashboardStatCard
            title="Low stock"
            value={overview.lowStock}
            change={overview.lowStock > 0 ? "Needs restock" : "All clear"}
            changeTone={overview.lowStock > 0 ? "warning" : "positive"}
            icon={AlertTriangle}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ stock: "out_of_stock" })}
        >
          <DashboardStatCard
            title="Out of stock"
            value={overview.outOfStock}
            change={overview.outOfStock > 0 ? "Unavailable" : "None"}
            changeTone={overview.outOfStock > 0 ? "warning" : "positive"}
            icon={PackageX}
            tone="neutral"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ stock: "all", status: "all", search: "" })}
        >
          <DashboardStatCard
            title="Total SKUs"
            value={overview.totalSkus}
            change={`${overview.totalUnits} units tracked`}
            changeTone="neutral"
            icon={Package}
            tone="bakery"
          />
        </button>
      </section>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <Card className="flex h-full flex-col shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Settings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-3 pt-0">
            <div className="space-y-1.5">
              <Label htmlFor="default-threshold" className="text-xs text-muted-foreground">
                Low stock warning threshold
              </Label>
              <Input
                id="default-threshold"
                type="number"
                min={1}
                value={settings.defaultLowStockThreshold}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultLowStockThreshold: Math.max(Number(event.target.value) || 1, 1),
                  }))
                }
              />
            </div>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 text-sm">
              <span>Track stock history</span>
              <Switch
                checked={settings.trackStockHistory}
                onCheckedChange={(checked) =>
                  setSettings((prev) => ({ ...prev, trackStockHistory: checked === true }))
                }
              />
            </label>
            <Button
              variant="bakery"
              className="mt-auto w-full"
              onClick={handleSaveSettings}
              disabled={!settingsDirty}
            >
              <Settings2 className="size-4" />
              Save settings
            </Button>
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col shadow-sm lg:max-h-[22rem]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent history</CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto pt-0">
            {history.length === 0 ? (
              <div className="flex h-full min-h-28 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 px-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">No adjustments yet</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{entry.cakeName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatStockHistoryReason(entry.reason)} · {entry.quantityBefore} →{" "}
                        {entry.quantityAfter}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatRelativeTime(entry.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <FilterPanel>
        <FilterPanelToolbar className="gap-2.5 sm:flex-row sm:items-center">
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search products…"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <AdminSelect
              className="w-full sm:w-40"
              value={filters.stock}
              onChange={(event) =>
                updateFilters({ stock: event.target.value as InventoryListFilters["stock"] })
              }
              aria-label="Stock status"
            >
              <option value="all">All stock</option>
              <option value="in_stock">In stock</option>
              <option value="low_stock">Low stock</option>
              <option value="out_of_stock">Out of stock</option>
              <option value="unlimited">Unlimited</option>
            </AdminSelect>
            <AdminSelect
              className="w-full sm:w-40"
              value={filters.status}
              onChange={(event) =>
                updateFilters({ status: event.target.value as InventoryListFilters["status"] })
              }
              aria-label="Publish status"
            >
              <option value="all">All publish</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </AdminSelect>
          </div>
        </FilterPanelToolbar>
      </FilterPanel>

      <section className={adminShell.tableCard}>
        {paginated.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No inventory records found"
            description="Try another filter, or add cakes to your catalog."
            className="py-14"
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Quantity</th>
                    <th className="px-4 py-3 font-medium">Threshold</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Publish</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((item) => (
                    <tr
                      key={item.cakeId}
                      className="border-b border-border/70 transition-colors last:border-0 hover:bg-muted"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                            {item.image ? (
                              <SafeImage
                                src={item.image}
                                alt={item.name}
                                className="object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{item.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{item.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.categoryName}</td>
                      <td className="px-4 py-3 font-semibold">
                        {item.unlimitedStock ? "∞" : item.stockQuantity}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.lowStockThreshold}
                      </td>
                      <td className="px-4 py-3">
                        <StockStatusBadge
                          status={item.stockStatus}
                          unlimited={item.unlimitedStock}
                          quantity={item.stockQuantity}
                          showQuantity
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={item.status === "published" ? "success" : "outline"}>
                          {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatRelativeTime(item.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => setAdjustTarget(item)}
                          >
                            Adjust
                          </Button>
                          <Button
                            size="sm"
                            variant={item.unlimitedStock ? "bakery" : "outline"}
                            className="h-8"
                            onClick={() => handleToggleUnlimited(item)}
                            aria-label={
                              item.unlimitedStock
                                ? "Unlimited stock on — click to set a limit"
                                : "Enable unlimited stock"
                            }
                            title={
                              item.unlimitedStock
                                ? "Unlimited stock on — click to set a limit"
                                : "Enable unlimited stock"
                            }
                          >
                            <InfinityIcon className="size-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8"
                            aria-label="Edit product"
                            title="Edit product"
                            render={<Link href={routes.admin.cakes.edit(item.cakeId)} />}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border lg:hidden">
              {paginated.map((item) => (
                <li key={item.cakeId} className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative size-12 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                      {item.image ? (
                        <SafeImage
                          src={item.image}
                          alt={item.name}
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {item.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.categoryName} · Qty:{" "}
                            {item.unlimitedStock ? "∞" : item.stockQuantity}
                          </p>
                        </div>
                        <StockStatusBadge
                          status={item.stockStatus}
                          unlimited={item.unlimitedStock}
                        />
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 flex-1"
                          onClick={() => setAdjustTarget(item)}
                        >
                          Adjust
                        </Button>
                        <Button
                          size="sm"
                          variant={item.unlimitedStock ? "bakery" : "outline"}
                          className="h-8 flex-1"
                          onClick={() => handleToggleUnlimited(item)}
                          aria-label={
                            item.unlimitedStock
                              ? "Unlimited stock on — click to set a limit"
                              : "Enable unlimited stock"
                          }
                        >
                          <InfinityIcon className="size-3.5" />
                          Unlimited
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          aria-label="Edit product"
                          title="Edit product"
                          render={<Link href={routes.admin.cakes.edit(item.cakeId)} />}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-border px-3 py-3 sm:px-4">
              <ListPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </section>

      <StockAdjustmentDialog
        item={adjustTarget}
        open={Boolean(adjustTarget)}
        onOpenChange={(open) => !open && setAdjustTarget(null)}
        onAdjusted={bump}
      />
    </AdminPage>
  );
}
