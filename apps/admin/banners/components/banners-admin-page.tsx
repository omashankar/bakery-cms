"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ExternalLink,
  Flag,
  ImageIcon,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import {
  FilterPanel,
  FilterPanelSearch,
  FilterPanelToolbar,
} from "@/components/shared/filter-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { SafeImage } from "@/components/shared/safe-image";
import { DashboardStatCard } from "@/apps/admin/dashboard/components/dashboard-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { formatRelativeTime } from "@/utils/format";
import type { Banner } from "@/types/media";
import { AdminPage, AdminPageHeader, adminShell } from "@/apps/admin/components";
import {
  bulkSetBannerActive,
  deleteBanners,
  loadBanners,
  resetBanners,
  toggleBannerActive,
} from "@/features/content/lib/banners-repository";
import {
  defaultBannerFilters,
  filterBanners,
  formatBannerPosition,
  formatBannerScheduleState,
  formatBannerVisibility,
  getBannerOverview,
  getBannerScheduleState,
  getBannerStatusVariant,
  type BannerListFilters,
  type BannerOverview,
} from "@/features/content/lib/banners-utils";
import { BannerFormDialog } from "./banner-form-dialog";
import { DeleteBannerDialog } from "./delete-banner-dialog";

const PAGE_SIZE = 10;

const EMPTY_OVERVIEW: BannerOverview = {
  total: 0,
  active: 0,
  hero: 0,
  inactive: 0,
  scheduled: 0,
  expired: 0,
};

function BannerRowActions({
  banner,
  onEdit,
  onDelete,
}: {
  banner: Banner;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Row actions" />}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-3.5" />
          Edit
        </DropdownMenuItem>
        {banner.link ? (
          <DropdownMenuItem
            render={<a href={banner.link} target="_blank" rel="noreferrer" />}
          >
            <ExternalLink className="size-3.5" />
            Open link
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BannersAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [filters, setFilters] = useState<BannerListFilters>(defaultBannerFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    ids: string[];
    title?: string;
  } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  function refresh() {
    setBanners(loadBanners());
    setMounted(true);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => filterBanners(banners, filters), [banners, filters]);
  const overview = useMemo(
    () => (mounted ? getBannerOverview(banners) : EMPTY_OVERVIEW),
    [banners, mounted]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const pageIds = paginated.map((banner) => banner.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const filtersActive =
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.position !== "all" ||
    filters.visibility !== "all" ||
    filters.sort !== "priority";

  function updateFilters(patch: Partial<BannerListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectAllPage() {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
  }

  function openCreate() {
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(id: string) {
    setEditingId(id);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const count = deleteBanners(deleteTarget.ids);
    refresh();
    setSelectedIds((prev) => prev.filter((id) => !deleteTarget.ids.includes(id)));
    toast.success(`Deleted ${count} banner${count === 1 ? "" : "s"}`);
    setDeleteTarget(null);
  }

  function applyBulkActive(isActive: boolean) {
    if (selectedIds.length === 0) return;
    const count = bulkSetBannerActive(selectedIds, isActive);
    refresh();
    toast.success(
      isActive
        ? `Activated ${count} banner${count === 1 ? "" : "s"}`
        : `Deactivated ${count} banner${count === 1 ? "" : "s"}`
    );
  }

  function confirmReset() {
    resetBanners();
    refresh();
    setSelectedIds([]);
    setResetOpen(false);
    toast.success("Banners reset to defaults");
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Banners"
        description="Manage promotional banners and hero slides"
        className="gap-3"
        actions={
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className="min-w-0 flex-1 sm:flex-none"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw className="size-4" />
              Reset
            </Button>
            <Button
              variant="bakery"
              className="min-w-0 flex-1 sm:flex-none"
              onClick={openCreate}
            >
              <Plus className="size-4" />
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">Add banner</span>
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "all", position: "all" })}
        >
          <DashboardStatCard
            title="Total"
            value={overview.total}
            change="All banners"
            changeTone="neutral"
            icon={Flag}
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
            value={overview.active}
            change="Live on storefront"
            changeTone="positive"
            icon={LayoutTemplate}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "active", position: "hero" })}
        >
          <DashboardStatCard
            title="Hero strip"
            value={overview.hero}
            change="Active hero banners"
            changeTone="neutral"
            icon={ImageIcon}
            tone="neutral"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "scheduled" })}
        >
          <DashboardStatCard
            title="Scheduled"
            value={overview.scheduled}
            change={
              overview.expired > 0
                ? `${overview.expired} expired`
                : overview.scheduled > 0
                  ? "Starts later"
                  : "None waiting"
            }
            changeTone={overview.scheduled > 0 || overview.expired > 0 ? "warning" : "neutral"}
            icon={CalendarClock}
            tone={overview.scheduled > 0 ? "gold" : "neutral"}
          />
        </button>
      </section>

      <FilterPanel>
        <FilterPanelToolbar>
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search by title, link, or image…"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:w-auto">
            <AdminSelect
              value={filters.status}
              onChange={(e) =>
                updateFilters({ status: e.target.value as BannerListFilters["status"] })
              }
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="scheduled">Scheduled</option>
              <option value="expired">Expired</option>
            </AdminSelect>
            <AdminSelect
              value={filters.position}
              onChange={(e) =>
                updateFilters({ position: e.target.value as BannerListFilters["position"] })
              }
            >
              <option value="all">All positions</option>
              <option value="hero">Hero</option>
              <option value="sidebar">Sidebar</option>
              <option value="popup">Popup</option>
            </AdminSelect>
            <AdminSelect
              value={filters.visibility}
              onChange={(e) =>
                updateFilters({
                  visibility: e.target.value as BannerListFilters["visibility"],
                })
              }
            >
              <option value="all">All visibility</option>
              <option value="storewide">All storefront pages</option>
              <option value="homepage">Homepage only</option>
              <option value="collections">Collections</option>
            </AdminSelect>
            <AdminSelect
              value={filters.sort}
              onChange={(e) =>
                updateFilters({ sort: e.target.value as BannerListFilters["sort"] })
              }
            >
              <option value="priority">Priority</option>
              <option value="newest">Recently updated</option>
              <option value="title">Title</option>
            </AdminSelect>
          </div>
        </FilterPanelToolbar>

        {filtersActive ? (
          <div className="mt-3 flex justify-end border-t border-border pt-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilters(defaultBannerFilters);
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : null}

        {selectedIds.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selected
            </span>
            <Button size="sm" variant="outline" onClick={() => applyBulkActive(true)}>
              Activate
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyBulkActive(false)}>
              Deactivate
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setDeleteTarget({ ids: selectedIds })}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
              Clear selection
            </Button>
          </div>
        ) : null}
      </FilterPanel>

      {!mounted ? (
        <div className="min-h-48 animate-pulse rounded-xl border border-border bg-muted" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No banners found"
          description={
            filtersActive
              ? "Try adjusting your filters or search."
              : "Create a promotional banner for the storefront hero strip."
          }
          action={
            !filtersActive ? (
              <Button variant="bakery" onClick={openCreate}>
                <Plus className="size-4" />
                Add banner
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={adminShell.tableCard}>
          <div className="hidden md:block">
            <div className={adminShell.tableScroll}>
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">
                      <Checkbox
                        checked={allPageSelected}
                        disabled={pageIds.length === 0}
                        onCheckedChange={toggleSelectAllPage}
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Banner</th>
                    <th className="px-4 py-3 font-medium">Position</th>
                    <th className="px-4 py-3 font-medium">Visibility</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Priority</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((banner) => {
                    const state = getBannerScheduleState(banner);
                    return (
                      <tr key={banner.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selectedIds.includes(banner.id)}
                            onCheckedChange={() => toggleSelect(banner.id)}
                            aria-label={`Select ${banner.title}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                              <SafeImage
                                src={banner.image}
                                alt={banner.title}
                                className="object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium">{banner.title}</p>
                              <p className="line-clamp-1 text-xs text-muted-foreground">
                                {banner.link || "No link"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">{formatBannerPosition(banner.position)}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatBannerVisibility(banner.visibility)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={banner.isActive}
                              onCheckedChange={() => {
                                toggleBannerActive(banner.id);
                                refresh();
                              }}
                              aria-label={`Toggle ${banner.title}`}
                            />
                            <Badge variant={getBannerStatusVariant(state)}>
                              {formatBannerScheduleState(state)}
                            </Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{banner.priority}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {formatRelativeTime(banner.updatedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <BannerRowActions
                            banner={banner}
                            onEdit={() => openEdit(banner.id)}
                            onDelete={() =>
                              setDeleteTarget({ ids: [banner.id], title: banner.title })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <ul className="divide-y divide-border md:hidden">
            {paginated.map((banner) => {
              const state = getBannerScheduleState(banner);
              return (
                <li key={banner.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      className="mt-1"
                      checked={selectedIds.includes(banner.id)}
                      onCheckedChange={() => toggleSelect(banner.id)}
                      aria-label={`Select ${banner.title}`}
                    />
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="relative aspect-[3/1] overflow-hidden rounded-lg border border-border bg-muted">
                        <SafeImage
                          src={banner.image}
                          alt={banner.title}
                          className="object-cover"
                        />
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{banner.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {banner.link || "No link"}
                          </p>
                        </div>
                        <BannerRowActions
                          banner={banner}
                          onEdit={() => openEdit(banner.id)}
                          onDelete={() =>
                            setDeleteTarget({ ids: [banner.id], title: banner.title })
                          }
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{formatBannerPosition(banner.position)}</Badge>
                        <Badge variant={getBannerStatusVariant(state)}>
                          {formatBannerScheduleState(state)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Priority {banner.priority}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={banner.isActive}
                            onCheckedChange={() => {
                              toggleBannerActive(banner.id);
                              refresh();
                            }}
                            aria-label={`Toggle ${banner.title}`}
                          />
                          <span className="text-xs text-muted-foreground">Visible</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(banner.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {filtered.length > PAGE_SIZE ? (
        <ListPagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      ) : null}

      <BannerFormDialog
        open={formOpen}
        bannerId={editingId}
        onOpenChange={setFormOpen}
        onSaved={refresh}
      />

      <DeleteBannerDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.title}
        count={deleteTarget?.ids.length}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset banners?</DialogTitle>
            <DialogDescription>
              Replace all banners with the default demo set. Custom banners will be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReset}>
              Reset defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
