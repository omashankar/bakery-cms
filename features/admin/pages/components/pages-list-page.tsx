"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  ExternalLink,
  FileText,
  FileCheck2,
  FilePenLine,
  MoreHorizontal,
  Pencil,
  Plus,
  Shield,
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
import { routes } from "@/constants/routes";
import { formatRelativeTime } from "@/utils/format";
import type { CmsPage } from "@/types/content";
import { AdminPage, AdminPageHeader, adminShell } from "@/features/admin/components";
import {
  bulkUpdatePageStatus,
  deletePages,
  loadPages,
  processScheduledPagePublishes,
} from "../lib/pages-repository";
import {
  defaultPageFilters,
  filterPages,
  formatPageStatus,
  formatPageTemplate,
  getPageOverview,
  getPageStatusVariant,
  getStorefrontPageUrl,
  type PageListFilters,
  type PageOverview,
} from "../lib/pages-utils";
import { DeletePageDialog } from "./delete-page-dialog";

function PageRowActions({
  item,
  onDelete,
}: {
  item: CmsPage;
  onDelete: () => void;
}) {
  const viewHref = `${getStorefrontPageUrl(item.slug)}${
    item.status === "published" ? "" : "?preview=1"
  }`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon" aria-label="Row actions" />}
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href={routes.admin.pages.edit(item.id)} />}>
          <Pencil className="size-3.5" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          render={<a href={viewHref} target="_blank" rel="noreferrer" />}
        >
          <ExternalLink className="size-3.5" />
          {item.status === "published" ? "View live" : "Preview draft"}
        </DropdownMenuItem>
        {!item.isSystem ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 className="size-3.5" />
              Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PAGE_SIZE = 10;

const EMPTY_OVERVIEW: PageOverview = {
  total: 0,
  published: 0,
  draft: 0,
  archived: 0,
  system: 0,
};

export function PagesListPage() {
  const [mounted, setMounted] = useState(false);
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [filters, setFilters] = useState<PageListFilters>(defaultPageFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{
    ids: string[];
    title?: string;
  } | null>(null);

  function refresh() {
    processScheduledPagePublishes();
    setPages(loadPages());
    setMounted(true);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => filterPages(pages, filters), [pages, filters]);
  const overview = useMemo(
    () => (mounted ? getPageOverview(pages) : EMPTY_OVERVIEW),
    [pages, mounted]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selectablePageIds = paginated
    .filter((item) => !item.isSystem)
    .map((item) => item.id);
  const allPageSelected =
    selectablePageIds.length > 0 &&
    selectablePageIds.every((id) => selectedIds.includes(id));

  const filtersActive =
    filters.search.trim() !== "" ||
    filters.status !== "all" ||
    filters.template !== "all" ||
    filters.sort !== "order";

  function updateFilters(patch: Partial<PageListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function toggleSelect(id: string) {
    const target = pages.find((item) => item.id === id);
    if (target?.isSystem) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectAllPage() {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !selectablePageIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...selectablePageIds])]);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const deletableIds = deleteTarget.ids.filter(
      (id) => !pages.find((item) => item.id === id)?.isSystem
    );
    const count = deletePages(deletableIds);
    refresh();
    setSelectedIds((prev) => prev.filter((id) => !deletableIds.includes(id)));
    toast.success(`${count} page${count === 1 ? "" : "s"} deleted`);
    setDeleteTarget(null);
  }

  function applyBulkStatus(status: CmsPage["status"]) {
    if (selectedIds.length === 0) return;
    bulkUpdatePageStatus(selectedIds, status);
    refresh();
    toast.success(
      status === "published"
        ? "Selected pages published"
        : status === "draft"
          ? "Selected pages set to draft"
          : "Selected pages archived"
    );
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Pages"
        description="Manage CMS pages and templates."
        className="gap-3"
        actions={
          <Button
            variant="bakery"
            className="w-full sm:w-auto"
            render={<Link href={routes.admin.pages.add} />}
          >
            <Plus className="size-4" />
            <span className="sm:hidden">Add</span>
            <span className="hidden sm:inline">Add Page</span>
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "all" })}
        >
          <DashboardStatCard
            title="Total"
            value={overview.total}
            change="All pages"
            changeTone="neutral"
            icon={FileText}
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
        <DashboardStatCard
          title="System"
          value={overview.system}
          change="Protected pages"
          changeTone="neutral"
          icon={Shield}
          tone="neutral"
        />
      </section>

      <FilterPanel>
        <FilterPanelToolbar>
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search by title, slug, or description…"
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:w-auto">
            <AdminSelect
              value={filters.status}
              onChange={(e) =>
                updateFilters({ status: e.target.value as PageListFilters["status"] })
              }
            >
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </AdminSelect>
            <AdminSelect
              value={filters.template}
              onChange={(e) =>
                updateFilters({ template: e.target.value as PageListFilters["template"] })
              }
            >
              <option value="all">All templates</option>
              <option value="standard">Standard</option>
              <option value="about">About layout</option>
            </AdminSelect>
            <AdminSelect
              value={filters.sort}
              onChange={(e) => updateFilters({ sort: e.target.value as PageListFilters["sort"] })}
            >
              <option value="order">Sort order</option>
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
                setFilters(defaultPageFilters);
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
          icon={FileText}
          title="No pages found"
          description={
            filtersActive
              ? "Try adjusting your filters or search."
              : "Create a page for About, policies, or custom content."
          }
          action={
            !filtersActive ? (
              <Button variant="bakery" render={<Link href={routes.admin.pages.add} />}>
                <Plus className="size-4" />
                Add Page
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
                        disabled={selectablePageIds.length === 0}
                        onCheckedChange={toggleSelectAllPage}
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Slug</th>
                    <th className="px-4 py-3 font-medium">Template</th>
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
                          disabled={item.isSystem}
                          onCheckedChange={() => toggleSelect(item.id)}
                          aria-label={`Select ${item.title}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{item.title}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">/{item.slug}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline">{formatPageTemplate(item.template)}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={getPageStatusVariant(item.status)}>
                            {formatPageStatus(item.status)}
                          </Badge>
                          {item.isSystem ? <Badge variant="secondary">System</Badge> : null}
                          {item.scheduledPublishAt ? (
                            <Badge variant="accent">Scheduled</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatRelativeTime(item.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <PageRowActions
                          item={item}
                          onDelete={() =>
                            setDeleteTarget({ ids: [item.id], title: item.title })
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
                    disabled={item.isSystem}
                    onCheckedChange={() => toggleSelect(item.id)}
                    aria-label={`Select ${item.title}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">/{item.slug}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge variant={getPageStatusVariant(item.status)}>
                          {formatPageStatus(item.status)}
                        </Badge>
                        <PageRowActions
                          item={item}
                          onDelete={() =>
                            setDeleteTarget({ ids: [item.id], title: item.title })
                          }
                        />
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge variant="outline">{formatPageTemplate(item.template)}</Badge>
                      {item.isSystem ? <Badge variant="secondary">System</Badge> : null}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Updated {formatRelativeTime(item.updatedAt)}
                    </p>
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

      <DeletePageDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget?.title}
        count={deleteTarget?.ids.length}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </AdminPage>
  );
}
