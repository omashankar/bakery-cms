"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  FileCheck2,
  FilePenLine,
  MoreHorizontal,
  Pencil,
  Plus,
  Quote,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/features/admin/cakes/components/admin-field";
import {
  FilterPanel,
  FilterPanelSearch,
  FilterPanelToolbar,
} from "@/components/shared/filter-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { SafeImage } from "@/components/shared/safe-image";
import { DashboardStatCard } from "@/features/admin/dashboard/components/dashboard-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/utils/format";
import type { Testimonial } from "@/types/content";
import { AdminPage, AdminPageHeader, adminShell } from "@/features/admin/components";
import {
  bulkUpdateTestimonialStatus,
  deleteTestimonials,
  loadTestimonials,
} from "../lib/testimonials-repository";
import {
  defaultTestimonialFilters,
  filterTestimonials,
  formatTestimonialStatus,
  getTestimonialOverview,
  getTestimonialStatusVariant,
  type TestimonialListFilters,
  type TestimonialOverview,
} from "../lib/testimonial-utils";
import { DeleteTestimonialDialog } from "./delete-testimonial-dialog";
import { TestimonialFormDialog } from "./testimonial-form-dialog";

const PAGE_SIZE = 10;

const EMPTY_OVERVIEW: TestimonialOverview = {
  total: 0,
  published: 0,
  draft: 0,
  archived: 0,
  featured: 0,
};

function TestimonialRowActions({
  onEdit,
  onDelete,
}: {
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
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-3.5" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TestimonialsAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<Testimonial[]>([]);
  const [filters, setFilters] = useState<TestimonialListFilters>(defaultTestimonialFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    ids: string[];
    name?: string;
  } | null>(null);

  function refresh() {
    setItems(loadTestimonials());
    setMounted(true);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => filterTestimonials(items, filters), [items, filters]);
  const overview = useMemo(
    () => (mounted ? getTestimonialOverview(items) : EMPTY_OVERVIEW),
    [items, mounted]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const pageIds = paginated.map((item) => item.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const filtersActive =
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.featured !== "all" ||
    filters.sort !== "order";

  function updateFilters(patch: Partial<TestimonialListFilters>) {
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
    const count = deleteTestimonials(deleteTarget.ids);
    refresh();
    setSelectedIds((prev) => prev.filter((id) => !deleteTarget.ids.includes(id)));
    toast.success(`${count} testimonial${count === 1 ? "" : "s"} deleted`);
    setDeleteTarget(null);
  }

  function applyBulkStatus(status: Testimonial["status"]) {
    if (selectedIds.length === 0) return;
    bulkUpdateTestimonialStatus(selectedIds, status);
    refresh();
    toast.success(
      status === "published"
        ? "Selected testimonials published"
        : status === "draft"
          ? "Selected testimonials set to draft"
          : "Selected testimonials archived"
    );
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Testimonials"
        description="Manage customer reviews for the storefront."
        className="gap-3"
        actions={
          <Button variant="bakery" className="w-full sm:w-auto" onClick={openCreate}>
            <Plus className="size-4" />
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add Testimonial</span>
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "all", featured: "all" })}
        >
          <DashboardStatCard
            title="Total"
            value={overview.total}
            change="All reviews"
            changeTone="neutral"
            icon={Quote}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "published" })}
        >
          <DashboardStatCard
            title="Published"
            value={overview.published}
            change="Live on store"
            changeTone="positive"
            icon={FileCheck2}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ featured: "featured" })}
        >
          <DashboardStatCard
            title="Featured"
            value={overview.featured}
            change="Homepage highlights"
            changeTone="neutral"
            icon={Star}
            tone="gold"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "draft" })}
        >
          <DashboardStatCard
            title="Drafts"
            value={overview.draft}
            change="Not published"
            changeTone="warning"
            icon={FilePenLine}
            tone="neutral"
          />
        </button>
      </section>

      <FilterPanel>
        <FilterPanelToolbar>
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search by name, role, or review…"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-auto">
            <AdminSelect
              value={filters.status}
              onChange={(e) =>
                updateFilters({ status: e.target.value as TestimonialListFilters["status"] })
              }
            >
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </AdminSelect>
            <AdminSelect
              value={filters.featured}
              onChange={(e) =>
                updateFilters({
                  featured: e.target.value as TestimonialListFilters["featured"],
                })
              }
            >
              <option value="all">All reviews</option>
              <option value="featured">Featured only</option>
            </AdminSelect>
            <AdminSelect
              value={filters.sort}
              onChange={(e) =>
                updateFilters({ sort: e.target.value as TestimonialListFilters["sort"] })
              }
            >
              <option value="order">Sort order</option>
              <option value="newest">Newest</option>
              <option value="name">Name</option>
            </AdminSelect>
          </div>
        </FilterPanelToolbar>

        {filtersActive ? (
          <div className="mt-3 flex justify-end border-t border-border pt-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilters(defaultTestimonialFilters);
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
            <Button size="sm" variant="outline" onClick={() => applyBulkStatus("published")}>
              Publish
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyBulkStatus("draft")}>
              Draft
            </Button>
            <Button size="sm" variant="outline" onClick={() => applyBulkStatus("archived")}>
              <Archive className="size-4" />
              Archive
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
          icon={Quote}
          title="No testimonials found"
          description={
            filtersActive
              ? "Try adjusting your filters or search."
              : "Add your first customer review for the storefront."
          }
          action={
            !filtersActive ? (
              <Button variant="bakery" onClick={openCreate}>
                <Plus className="size-4" />
                Add Testimonial
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={adminShell.tableCard}>
          <div className="hidden md:block">
            <div className={adminShell.tableScroll}>
              <table className="w-full min-w-[760px] text-sm">
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
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Review</th>
                    <th className="px-4 py-3 font-medium">Rating</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Updated</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((item) => (
                    <tr key={item.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedIds.includes(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                          aria-label={`Select ${item.name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="relative size-10 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                            {item.avatar ? (
                              <SafeImage
                                src={item.avatar}
                                alt={item.name}
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex size-full items-center justify-center text-sm font-semibold text-primary">
                                {item.name.charAt(0)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium">{item.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.role || "Customer"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="line-clamp-2 max-w-sm text-muted-foreground">
                          &ldquo;{item.content}&rdquo;
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: item.rating }).map((_, index) => (
                            <Star
                              key={index}
                              className="size-3.5 fill-gold-400 text-gold-400"
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={getTestimonialStatusVariant(item.status)}>
                            {formatTestimonialStatus(item.status)}
                          </Badge>
                          {item.isFeatured ? (
                            <Badge variant="secondary">Featured</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatRelativeTime(item.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <TestimonialRowActions
                          onEdit={() => openEdit(item.id)}
                          onDelete={() =>
                            setDeleteTarget({ ids: [item.id], name: item.name })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <ul className="divide-y divide-border md:hidden">
            {paginated.map((item) => (
              <li key={item.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    className="mt-1"
                    checked={selectedIds.includes(item.id)}
                    onCheckedChange={() => toggleSelect(item.id)}
                    aria-label={`Select ${item.name}`}
                  />
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                          {item.avatar ? (
                            <SafeImage
                              src={item.avatar}
                              alt={item.name}
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-sm font-semibold text-primary">
                              {item.name.charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.role || "Customer"}
                          </p>
                        </div>
                      </div>
                      <TestimonialRowActions
                        onEdit={() => openEdit(item.id)}
                        onDelete={() =>
                          setDeleteTarget({ ids: [item.id], name: item.name })
                        }
                      />
                    </div>
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      &ldquo;{item.content}&rdquo;
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: item.rating }).map((_, index) => (
                          <Star
                            key={index}
                            className="size-3.5 fill-gold-400 text-gold-400"
                          />
                        ))}
                      </div>
                      <Badge variant={getTestimonialStatusVariant(item.status)}>
                        {formatTestimonialStatus(item.status)}
                      </Badge>
                      {item.isFeatured ? (
                        <Badge variant="secondary">Featured</Badge>
                      ) : null}
                    </div>
                  </div>
                </div>
              </li>
            ))}
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

      <TestimonialFormDialog
        open={formOpen}
        testimonialId={editingId}
        onOpenChange={setFormOpen}
        onSaved={refresh}
      />

      <DeleteTestimonialDialog
        open={Boolean(deleteTarget)}
        name={deleteTarget?.name}
        count={deleteTarget?.ids.length}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </AdminPage>
  );
}
