"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Mail, Trash2, UserCheck, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/features/admin/cakes/components/admin-field";
import {
  FilterPanel,
  FilterPanelSearch,
  FilterPanelToolbar,
} from "@/components/shared/filter-panel";
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
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { DashboardStatCard } from "@/features/admin/dashboard/components/dashboard-stat-card";
import { AdminPage, AdminPageHeader, adminShell } from "@/features/admin/components";
import { formatRelativeTime } from "@/utils/format";
import type { NewsletterSubscriber } from "@/types/inquiry";
import {
  defaultNewsletterFilters,
  deleteNewsletterSubscribers,
  filterNewsletterSubscribers,
  loadNewsletterSubscribers,
  updateNewsletterSubscriber,
  type NewsletterFilters,
} from "../lib/newsletter-repository";

const PAGE_SIZE = 12;

export function NewsletterSubscribersPage() {
  const [mounted, setMounted] = useState(false);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [filters, setFilters] = useState<NewsletterFilters>(defaultNewsletterFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);

  function refresh() {
    setSubscribers(loadNewsletterSubscribers());
    setMounted(true);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(
    () => filterNewsletterSubscribers(subscribers, filters),
    [subscribers, filters]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeCount = mounted
    ? subscribers.filter((item) => item.isActive).length
    : 0;
  const inactiveCount = mounted ? subscribers.length - activeCount : 0;
  const totalCount = mounted ? subscribers.length : 0;

  function updateFilters(patch: Partial<NewsletterFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
    setSelectedIds([]);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleActive(subscriber: NewsletterSubscriber) {
    const updated = updateNewsletterSubscriber(subscriber.id, {
      isActive: !subscriber.isActive,
    });
    if (updated) {
      refresh();
      toast.success(updated.isActive ? "Subscriber activated" : "Subscriber deactivated");
    }
  }

  async function copyEmails() {
    if (filtered.length === 0) {
      toast.error("No emails to copy");
      return;
    }
    const emails = filtered.map((item) => item.email).join(", ");
    try {
      await navigator.clipboard.writeText(emails);
      toast.success(`Copied ${filtered.length} email${filtered.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Could not copy emails");
    }
  }

  function confirmDelete() {
    const count = deleteNewsletterSubscribers(selectedIds);
    refresh();
    setSelectedIds([]);
    toast.success(`${count} subscriber${count === 1 ? "" : "s"} removed`);
    setDeleteOpen(false);
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Newsletter"
        description="Email signups from the website."
        className="gap-3"
        actions={
          <Button variant="bakery" className="w-full sm:w-auto" onClick={copyEmails}>
            <Copy className="size-4" />
            <span className="sm:hidden">Copy</span>
            <span className="hidden sm:inline">Copy emails</span>
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 sm:grid-cols-3">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "all", search: "" })}
        >
          <DashboardStatCard
            title="Total"
            value={totalCount}
            change="All subscribers"
            changeTone="neutral"
            icon={Users}
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
            value={activeCount}
            change="Receiving emails"
            changeTone="positive"
            icon={UserCheck}
            tone="gold"
          />
        </button>
        <button
          type="button"
          className="col-span-2 h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-1"
          onClick={() => updateFilters({ status: "inactive" })}
        >
          <DashboardStatCard
            title="Inactive"
            value={inactiveCount}
            change="Paused"
            changeTone="neutral"
            icon={UserX}
            tone="neutral"
          />
        </button>
      </section>

      <FilterPanel>
        <FilterPanelToolbar className="gap-2.5 sm:flex-row sm:items-center">
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search by email…"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <AdminSelect
              className="w-full sm:w-36"
              value={filters.status}
              onChange={(event) =>
                updateFilters({ status: event.target.value as NewsletterFilters["status"] })
              }
              aria-label="Subscriber status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </AdminSelect>
            <AdminSelect
              className="w-full sm:w-32"
              value={filters.sort}
              onChange={(event) =>
                updateFilters({ sort: event.target.value as NewsletterFilters["sort"] })
              }
              aria-label="Sort order"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="email">Email</option>
            </AdminSelect>
          </div>
        </FilterPanelToolbar>
      </FilterPanel>

      <section className={adminShell.tableCard}>
        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-3 sm:px-4">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selected
            </span>
            <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="size-4" />
              Remove
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
              Clear
            </Button>
          </div>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No subscribers found"
            description="Newsletter signups from the public site will appear here."
            className="py-14"
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {paginated.map((subscriber) => (
                <li
                  key={subscriber.id}
                  className="flex flex-wrap items-center gap-3 px-3 py-3 sm:px-4"
                >
                  <Checkbox
                    checked={selectedIds.includes(subscriber.id)}
                    onCheckedChange={() => toggleSelect(subscriber.id)}
                    aria-label={`Select ${subscriber.email}`}
                  />
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Mail className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{subscriber.email}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {subscriber.source ?? "Website"} ·{" "}
                      {formatRelativeTime(subscriber.createdAt)}
                    </p>
                  </div>
                  <Badge variant={subscriber.isActive ? "success" : "outline"}>
                    {subscriber.isActive ? "Active" : "Inactive"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => toggleActive(subscriber)}
                  >
                    {subscriber.isActive ? "Deactivate" : "Activate"}
                  </Button>
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

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove subscribers?</DialogTitle>
            <DialogDescription>
              Remove {selectedIds.length} subscriber{selectedIds.length === 1 ? "" : "s"} from
              the list?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
