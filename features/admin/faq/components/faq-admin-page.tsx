"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  FileCheck2,
  FilePenLine,
  HelpCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Quote,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/features/admin/products/components/admin-field";
import {
  FilterPanel,
  FilterPanelSearch,
  FilterPanelToolbar,
} from "@/components/shared/filter-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
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
import type { FaqItem } from "@/types/content";
import { AdminPage, AdminPageHeader, adminShell } from "@/features/admin/components";
import { bulkUpdateFaqStatus, deleteFaqs, loadFaqs } from "@/features/content/lib/faq-repository";
import {
  defaultFaqFilters,
  faqCategoryOptions,
  filterFaqs,
  formatFaqCategory,
  formatFaqStatus,
  getFaqOverview,
  getFaqStatusVariant,
  type FaqListFilters,
  type FaqOverview,
} from "@/features/content/lib/faq-utils";
import { DeleteFaqDialog } from "./delete-faq-dialog";
import { FaqFormDialog } from "./faq-form-dialog";

const PAGE_SIZE = 10;

const EMPTY_OVERVIEW: FaqOverview = {
  total: 0,
  published: 0,
  draft: 0,
  archived: 0,
  byCategory: {
    general: 0,
    orders: 0,
    wedding: 0,
    delivery: 0,
  },
};

function FaqRowActions({
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

export function FaqAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<FaqItem[]>([]);
  const [filters, setFilters] = useState<FaqListFilters>(defaultFaqFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    ids: string[];
    question?: string;
  } | null>(null);

  function refresh() {
    setItems(loadFaqs());
    setMounted(true);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => filterFaqs(items, filters), [items, filters]);
  const overview = useMemo(
    () => (mounted ? getFaqOverview(items) : EMPTY_OVERVIEW),
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
    filters.category !== "all" ||
    filters.status !== "all" ||
    filters.sort !== "order";

  function updateFilters(patch: Partial<FaqListFilters>) {
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
    const count = deleteFaqs(deleteTarget.ids);
    refresh();
    setSelectedIds((prev) => prev.filter((id) => !deleteTarget.ids.includes(id)));
    toast.success(`${count} question${count === 1 ? "" : "s"} deleted`);
    setDeleteTarget(null);
  }

  function applyBulkStatus(status: FaqItem["status"]) {
    if (selectedIds.length === 0) return;
    bulkUpdateFaqStatus(selectedIds, status);
    refresh();
    toast.success(
      status === "published"
        ? "Selected FAQs published"
        : status === "draft"
          ? "Selected FAQs set to draft"
          : "Selected FAQs archived"
    );
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="FAQ"
        description="Manage frequently asked questions for the storefront."
        className="gap-3"
        actions={
          <Button variant="bakery" className="w-full sm:w-auto" onClick={openCreate}>
            <Plus className="size-4" />
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add FAQ</span>
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "all", category: "all" })}
        >
          <DashboardStatCard
            title="Total"
            value={overview.total}
            change="All questions"
            changeTone="neutral"
            icon={HelpCircle}
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
          onClick={() => updateFilters({ status: "draft" })}
        >
          <DashboardStatCard
            title="Drafts"
            value={overview.draft}
            change="Not published"
            changeTone="warning"
            icon={FilePenLine}
            tone="gold"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ category: "wedding" })}
        >
          <DashboardStatCard
            title="Wedding"
            value={overview.byCategory.wedding}
            change="Wedding category"
            changeTone="neutral"
            icon={Quote}
            tone="neutral"
          />
        </button>
      </section>

      <FilterPanel>
        <FilterPanelToolbar>
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search questions or answers…"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-auto">
            <AdminSelect
              value={filters.category}
              onChange={(e) =>
                updateFilters({ category: e.target.value as FaqListFilters["category"] })
              }
            >
              <option value="all">All categories</option>
              {faqCategoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AdminSelect>
            <AdminSelect
              value={filters.status}
              onChange={(e) =>
                updateFilters({ status: e.target.value as FaqListFilters["status"] })
              }
            >
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </AdminSelect>
            <AdminSelect
              value={filters.sort}
              onChange={(e) =>
                updateFilters({ sort: e.target.value as FaqListFilters["sort"] })
              }
            >
              <option value="order">Sort order</option>
              <option value="newest">Newest</option>
              <option value="question">Question</option>
            </AdminSelect>
          </div>
        </FilterPanelToolbar>

        {filtersActive ? (
          <div className="mt-3 flex justify-end border-t border-border pt-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilters(defaultFaqFilters);
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
          icon={HelpCircle}
          title="No FAQ items found"
          description={
            filtersActive
              ? "Try adjusting your filters or search."
              : "Add your first question for the storefront FAQ page."
          }
          action={
            !filtersActive ? (
              <Button variant="bakery" onClick={openCreate}>
                <Plus className="size-4" />
                Add FAQ
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
                    <th className="px-4 py-3 font-medium">Question</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Order</th>
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
                          aria-label={`Select ${item.question}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.question}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {item.answer}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{formatFaqCategory(item.category)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getFaqStatusVariant(item.status)}>
                          {formatFaqStatus(item.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.sortOrder}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatRelativeTime(item.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <FaqRowActions
                          onEdit={() => openEdit(item.id)}
                          onDelete={() =>
                            setDeleteTarget({
                              ids: [item.id],
                              question: item.question,
                            })
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
                    aria-label={`Select ${item.question}`}
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{item.question}</p>
                      <FaqRowActions
                        onEdit={() => openEdit(item.id)}
                        onDelete={() =>
                          setDeleteTarget({
                            ids: [item.id],
                            question: item.question,
                          })
                        }
                      />
                    </div>
                    <p className="line-clamp-2 text-sm text-muted-foreground">{item.answer}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{formatFaqCategory(item.category)}</Badge>
                      <Badge variant={getFaqStatusVariant(item.status)}>
                        {formatFaqStatus(item.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(item.updatedAt)}
                      </span>
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

      <FaqFormDialog
        open={formOpen}
        faqId={editingId}
        onOpenChange={setFormOpen}
        onSaved={refresh}
      />

      <DeleteFaqDialog
        open={Boolean(deleteTarget)}
        question={deleteTarget?.question}
        count={deleteTarget?.ids.length}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </AdminPage>
  );
}
