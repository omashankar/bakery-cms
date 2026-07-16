"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/features/admin/cakes/components/admin-field";
import { DeliveryZoneFormDialog } from "@/features/admin/commerce/components/delivery-zone-form-dialog";
import { formatZoneDeliveryTime } from "@/features/admin/commerce/lib/delivery-zone-utils";
import {
  defaultDeliveryZoneFilters,
  type DeliveryZone,
  type DeliveryZoneListFilters,
} from "@/types/delivery";
import {
  deleteDeliveryZones,
  DELIVERY_ZONES_UPDATED_EVENT,
  filterDeliveryZones,
  getDeliveryZoneStats,
  getUniqueZoneCities,
  loadDeliveryZones,
  resetDeliveryZones,
  toggleDeliveryZoneActive,
} from "@/features/admin/commerce/lib/delivery-zones-repository";
import {
  FilterPanel,
  FilterPanelSearch,
} from "@/components/shared/filter-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { AdminPage, AdminPageHeader, adminShell } from "@/features/admin/components";
import { DashboardStatCard } from "@/features/admin/dashboard/components/dashboard-stat-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { formatCurrency, formatRelativeTime } from "@/utils/format";

const PAGE_SIZE = 10;

const EMPTY_STATS = {
  total: 0,
  active: 0,
  inactive: 0,
  cities: 0,
};

function exportZonesToCsv(zones: DeliveryZone[]): void {
  const headers = [
    "Name",
    "City",
    "Pincode",
    "RadiusKm",
    "Charge",
    "MinDays",
    "EstDays",
    "Priority",
    "Active",
    "Updated",
  ];
  const rows = zones.map((zone) => [
    zone.name,
    zone.city,
    zone.pincode,
    String(zone.radiusKm),
    String(zone.deliveryCharge),
    String(zone.minDeliveryDays),
    String(zone.estimatedDeliveryDays),
    String(zone.priority),
    zone.isActive ? "yes" : "no",
    zone.updatedAt,
  ]);
  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bakery-delivery-zones-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function DeliveryZonesAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [filters, setFilters] = useState<DeliveryZoneListFilters>(defaultDeliveryZoneFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);

  useEffect(() => {
    function refresh() {
      setZones(loadDeliveryZones());
    }
    refresh();
    setMounted(true);
    window.addEventListener(DELIVERY_ZONES_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(DELIVERY_ZONES_UPDATED_EVENT, refresh);
  }, []);

  const stats = useMemo(
    () => (mounted ? getDeliveryZoneStats(zones) : EMPTY_STATS),
    [zones, mounted]
  );
  const cities = useMemo(() => getUniqueZoneCities(zones), [zones]);
  const filtered = useMemo(() => filterDeliveryZones(zones, filters), [zones, filters]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const pageIds = paginated.map((zone) => zone.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  function updateFilters(patch: Partial<DeliveryZoneListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
    setSelectedIds([]);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectPage() {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
  }

  function openCreate() {
    setEditingZone(null);
    setFormOpen(true);
  }

  function openEdit(zone: DeliveryZone) {
    setEditingZone(zone);
    setFormOpen(true);
  }

  function handleDelete() {
    if (selectedIds.length === 0) return;
    const count = deleteDeliveryZones(selectedIds);
    setSelectedIds([]);
    setZones(loadDeliveryZones());
    toast.success(`Deleted ${count} zone${count === 1 ? "" : "s"}`);
  }

  function handleReset() {
    resetDeliveryZones();
    setSelectedIds([]);
    setZones(loadDeliveryZones());
    toast.success("Delivery zones reset to defaults");
  }

  function handleExport() {
    const target =
      selectedIds.length > 0
        ? zones.filter((zone) => selectedIds.includes(zone.id))
        : filtered;
    if (target.length === 0) {
      toast.error("No zones to export");
      return;
    }
    exportZonesToCsv(target);
    toast.success(`Exported ${target.length} zone${target.length === 1 ? "" : "s"}`);
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Delivery Zones"
        description="Manage city and pincode delivery zones."
        className="gap-3"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" className="w-full sm:w-auto" onClick={handleReset}>
              <RotateCcw className="size-4" />
              <span className="sm:hidden">Reset</span>
              <span className="hidden sm:inline">Reset demo</span>
            </Button>
            <Button variant="bakery" className="w-full sm:w-auto" onClick={openCreate}>
              <Plus className="size-4" />
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">Add zone</span>
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "all", city: "all", search: "" })}
        >
          <DashboardStatCard
            title="Total zones"
            value={stats.total}
            change="All zones"
            changeTone="neutral"
            icon={MapPin}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "active" })}
        >
          <DashboardStatCard
            title="Active"
            value={stats.active}
            change="Used at checkout"
            changeTone="positive"
            icon={CheckCircle2}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "inactive" })}
        >
          <DashboardStatCard
            title="Inactive"
            value={stats.inactive}
            change={stats.inactive > 0 ? "Hidden from checkout" : "None"}
            changeTone="neutral"
            icon={XCircle}
            tone="neutral"
          />
        </button>
        <DashboardStatCard
          title="Cities"
          value={stats.cities}
          change="Coverage"
          changeTone="neutral"
          icon={MapPin}
          tone="gold"
        />
      </section>

      <FilterPanel>
        <div className="space-y-3">
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search zone, city, pincode…"
          />
          <div className="grid grid-cols-2 gap-2">
            <AdminSelect
              value={filters.status}
              onChange={(event) =>
                updateFilters({
                  status: event.target.value as DeliveryZoneListFilters["status"],
                })
              }
              aria-label="Zone status"
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </AdminSelect>
            <AdminSelect
              value={filters.city}
              onChange={(event) => updateFilters({ city: event.target.value })}
              aria-label="City filter"
            >
              <option value="all">All cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </AdminSelect>
          </div>
        </div>
      </FilterPanel>

      <section className={adminShell.tableCard}>
        {selectedIds.length > 0 ? (
          <div className="flex flex-col gap-2 border-b border-border px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleExport}>
                Export
              </Button>
              <Button size="sm" variant="destructive" onClick={handleDelete}>
                <Trash2 className="size-3.5" />
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        {paginated.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No delivery zones found"
            description="Create zones, then enable zone pricing in Shipping rules."
            className="py-14"
            action={
              <Button variant="bakery" onClick={openCreate}>
                <Plus className="size-4" />
                Add zone
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">
                      <Checkbox
                        checked={allPageSelected}
                        onCheckedChange={toggleSelectPage}
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Zone</th>
                    <th className="px-4 py-3 font-medium">City</th>
                    {/* Zones match a full 6-digit pincode or a prefix — say so, or a
                        short value like "411" reads as broken data next to "400001". */}
                    <th className="px-4 py-3 font-medium">Pincode / prefix</th>
                    <th className="px-4 py-3 font-medium">Radius</th>
                    <th className="px-4 py-3 font-medium">Charge</th>
                    <th className="px-4 py-3 font-medium">Delivery time</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((zone) => (
                    <tr
                      key={zone.id}
                      className="border-b border-border/70 transition-colors hover:bg-muted last:border-0"
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedIds.includes(zone.id)}
                          onCheckedChange={() => toggleSelect(zone.id)}
                          aria-label={`Select ${zone.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{zone.name}</td>
                      <td className="px-4 py-3">{zone.city}</td>
                      <td className="px-4 py-3 font-mono text-xs">{zone.pincode}</td>
                      <td className="px-4 py-3">{zone.radiusKm} km</td>
                      <td className="px-4 py-3 font-semibold">
                        {formatCurrency(zone.deliveryCharge)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatZoneDeliveryTime(zone)}
                      </td>
                      <td className="px-4 py-3">{zone.priority}</td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={zone.isActive}
                          onCheckedChange={() => {
                            toggleDeliveryZoneActive(zone.id);
                            setZones(loadDeliveryZones());
                          }}
                          aria-label={zone.isActive ? "Deactivate zone" : "Activate zone"}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatRelativeTime(zone.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="outline" onClick={() => openEdit(zone)}>
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border lg:hidden">
              {paginated.map((zone) => (
                <li key={zone.id} className="p-3 sm:p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      className="mt-0.5"
                      checked={selectedIds.includes(zone.id)}
                      onCheckedChange={() => toggleSelect(zone.id)}
                      aria-label={`Select ${zone.name}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{zone.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {zone.city} · {zone.pincode}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-semibold">
                          {formatCurrency(zone.deliveryCharge)}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Switch
                          checked={zone.isActive}
                          onCheckedChange={() => {
                            toggleDeliveryZoneActive(zone.id);
                            setZones(loadDeliveryZones());
                          }}
                          aria-label={zone.isActive ? "Deactivate zone" : "Activate zone"}
                        />
                        <span className="text-xs text-muted-foreground">
                          {formatZoneDeliveryTime(zone)}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 w-full"
                        onClick={() => openEdit(zone)}
                      >
                        <Pencil className="size-3.5" />
                        Edit zone
                      </Button>
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

      <DeliveryZoneFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        zone={editingZone}
        onSaved={() => {
          setSelectedIds([]);
          setZones(loadDeliveryZones());
        }}
      />
    </AdminPage>
  );
}
