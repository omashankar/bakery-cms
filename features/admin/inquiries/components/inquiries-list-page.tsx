"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDashed,
  MessageSquare,
  Reply,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/features/admin/products/components/admin-field";
import {
  FilterPanel,
  FilterPanelSearch,
  FilterPanelToolbar,
} from "@/components/shared/filter-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { MobileDetailDrawer } from "@/components/shared/mobile-detail-drawer";
import { DashboardStatCard } from "@/features/admin/dashboard/components/dashboard-stat-card";
import { AdminPage, AdminPageHeader, adminShell } from "@/features/admin/components";
import { cn } from "@/lib/utils";
import type { Inquiry, InquiryStatus, InquiryType } from "@/types/inquiry";
import { formatDate, formatRelativeTime } from "@/utils/format";
import {
  deleteInquiries,
  INQUIRIES_UPDATED_EVENT,
  loadInquiries,
} from "@/features/inquiries/lib/inquiries-repository";
import {
  countInquiriesByStatus,
  defaultInquiryFilters,
  filterInquiries,
  formatInquiryType,
  type InquiryListFilters,
} from "@/features/inquiries/lib/inquiry-utils";
import { DeleteInquiryDialog } from "./delete-inquiry-dialog";
import { InquiryDetailPanel } from "./inquiry-detail-panel";
import { InquiryStatusBadge } from "./inquiry-status-badge";

const PAGE_SIZE = 10;

interface InquiriesListPageProps {
  fixedType?: InquiryType;
  title?: string;
  description?: string;
  /** When rendered inside the Inquiries hub tabs — skips the page header/shell. */
  embedded?: boolean;
}

export function InquiriesListPage({
  fixedType,
  title = "Inquiries",
  description = "Customer messages and follow-ups",
  embedded = false,
}: InquiriesListPageProps) {
  const [mounted, setMounted] = useState(false);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [filters, setFilters] = useState<InquiryListFilters>({
    ...defaultInquiryFilters,
    type: fixedType ?? "all",
  });
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<{
    ids: string[];
    name?: string;
  } | null>(null);

  useEffect(() => {
    function refreshList() {
      const loaded = loadInquiries().filter((item) => {
        if (item.type === "newsletter") return false;
        if (fixedType) return item.type === fixedType;
        return true;
      });
      setInquiries(loaded);
      setMounted(true);
    }

    refreshList();
    window.addEventListener(INQUIRIES_UPDATED_EVENT, refreshList);
    return () => window.removeEventListener(INQUIRIES_UPDATED_EVENT, refreshList);
  }, [fixedType]);

  function refresh() {
    const loaded = loadInquiries().filter((item) => {
      if (item.type === "newsletter") return false;
      if (fixedType) return item.type === fixedType;
      return true;
    });
    setInquiries(loaded);
    setMounted(true);
  }

  const filtered = useMemo(
    () => filterInquiries(inquiries, filters, fixedType),
    [inquiries, filters, fixedType]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedInquiry = inquiries.find((item) => item.id === selectedId) ?? null;

  const stats = useMemo(
    () =>
      mounted
        ? {
            new: countInquiriesByStatus(inquiries, "new"),
            inProgress: countInquiriesByStatus(inquiries, "in_progress"),
            replied: countInquiriesByStatus(inquiries, "replied"),
            closed: countInquiriesByStatus(inquiries, "closed"),
            total: inquiries.length,
          }
        : { new: 0, inProgress: 0, replied: 0, closed: 0, total: 0 },
    [inquiries, mounted]
  );

  const pageIds = paginated.map((item) => item.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  function updateFilters(patch: Partial<InquiryListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
    setSelectedIds([]);
  }

  function setStatusFilter(status: InquiryStatus | "all") {
    updateFilters({ status });
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

  function confirmDelete() {
    if (!deleteTarget) return;
    const count = deleteInquiries(deleteTarget.ids);
    refresh();
    setSelectedIds((prev) => prev.filter((id) => !deleteTarget.ids.includes(id)));
    if (selectedId && deleteTarget.ids.includes(selectedId)) setSelectedId(null);
    toast.success(`${count} inquiry${count === 1 ? "" : "ies"} deleted`);
    setDeleteTarget(null);
  }

  const body = (
    <>
      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setStatusFilter("new")}
        >
          <DashboardStatCard
            title="New"
            value={stats.new}
            change={stats.new > 0 ? "Needs reply" : "All clear"}
            changeTone={stats.new > 0 ? "warning" : "positive"}
            icon={MessageSquare}
            tone="gold"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setStatusFilter("in_progress")}
        >
          <DashboardStatCard
            title="In progress"
            value={stats.inProgress}
            change="Being handled"
            changeTone="neutral"
            icon={CircleDashed}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setStatusFilter("replied")}
        >
          <DashboardStatCard
            title="Replied"
            value={stats.replied}
            change="Awaiting close"
            changeTone="positive"
            icon={Reply}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setStatusFilter("closed")}
        >
          <DashboardStatCard
            title="Closed"
            value={stats.closed}
            change="Resolved"
            changeTone="neutral"
            icon={CheckCircle2}
            tone="neutral"
          />
        </button>
      </section>

      <FilterPanel>
        <FilterPanelToolbar className="gap-2.5 sm:flex-row sm:items-center">
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search name, email, subject…"
          />
          <div
            className={cn(
              "grid gap-2 sm:flex sm:shrink-0",
              fixedType ? "grid-cols-2 sm:grid-cols-none" : "grid-cols-2 lg:grid-cols-4"
            )}
          >
            {!fixedType && !embedded ? (
              <AdminSelect
                className="w-full sm:w-36"
                value={filters.type}
                onChange={(event) =>
                  updateFilters({ type: event.target.value as InquiryListFilters["type"] })
                }
                aria-label="Inquiry type"
              >
                <option value="all">All types</option>
                <option value="wedding">Wedding</option>
                <option value="contact">Contact</option>
              </AdminSelect>
            ) : null}
            <AdminSelect
              className="w-full sm:w-36"
              value={filters.status}
              onChange={(event) =>
                updateFilters({ status: event.target.value as InquiryListFilters["status"] })
              }
              aria-label="Inquiry status"
            >
              <option value="all">All statuses</option>
              <option value="new">New</option>
              <option value="in_progress">In progress</option>
              <option value="replied">Replied</option>
              <option value="closed">Closed</option>
            </AdminSelect>
            <AdminSelect
              className="w-full sm:w-36"
              value={filters.date}
              onChange={(event) =>
                updateFilters({ date: event.target.value as InquiryListFilters["date"] })
              }
              aria-label="Date range"
            >
              <option value="all">All dates</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </AdminSelect>
            <AdminSelect
              className="w-full sm:w-32"
              value={filters.sort}
              onChange={(event) =>
                updateFilters({ sort: event.target.value as InquiryListFilters["sort"] })
              }
              aria-label="Sort order"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
            </AdminSelect>
          </div>
        </FilterPanelToolbar>
      </FilterPanel>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,20rem)]">
        <div className="min-w-0 space-y-4">
          {filtered.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No inquiries found"
              description="Try another filter, or wait for new form submissions."
            />
          ) : (
            <>
              <section className={adminShell.tableCard}>
                {selectedIds.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-3 sm:px-4">
                    <span className="text-sm text-muted-foreground">
                      {selectedIds.length} selected
                    </span>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleteTarget({ ids: selectedIds })}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                      Clear
                    </Button>
                  </div>
                ) : null}

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3 font-medium">
                          <Checkbox
                            checked={allPageSelected}
                            onCheckedChange={toggleSelectPage}
                            aria-label="Select all on page"
                          />
                        </th>
                        <th className="px-4 py-3 font-medium">Customer</th>
                        {!fixedType ? (
                          <th className="px-4 py-3 font-medium">Type</th>
                        ) : null}
                        <th className="px-4 py-3 font-medium">Subject</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map((inquiry) => (
                        <tr
                          key={inquiry.id}
                          onClick={() => setSelectedId(inquiry.id)}
                          className={cn(
                            "cursor-pointer border-b border-border/60 last:border-0 hover:bg-muted",
                            selectedId === inquiry.id && "bg-muted"
                          )}
                        >
                          <td
                            className="px-4 py-3"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Checkbox
                              checked={selectedIds.includes(inquiry.id)}
                              onCheckedChange={() => toggleSelect(inquiry.id)}
                              aria-label={`Select ${inquiry.name}`}
                            />
                          </td>
                          <td className="max-w-[180px] px-4 py-3">
                            <p className="truncate font-medium text-foreground">
                              {inquiry.name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {inquiry.email}
                            </p>
                          </td>
                          {!fixedType ? (
                            <td className="px-4 py-3">
                              <Badge variant="outline" className="text-[10px]">
                                {formatInquiryType(inquiry.type)}
                              </Badge>
                            </td>
                          ) : null}
                          <td className="max-w-[14rem] truncate px-4 py-3 text-muted-foreground xl:max-w-xs">
                            {inquiry.subject ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <InquiryStatusBadge status={inquiry.status} />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                            <span title={formatDate(inquiry.createdAt)}>
                              {formatRelativeTime(inquiry.createdAt)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="divide-y divide-border md:hidden">
                  {paginated.map((inquiry) => (
                    <li key={inquiry.id}>
                      <div className="flex items-start gap-3 p-3 sm:p-4">
                        <Checkbox
                          className="mt-0.5"
                          checked={selectedIds.includes(inquiry.id)}
                          onCheckedChange={() => toggleSelect(inquiry.id)}
                          aria-label={`Select ${inquiry.name}`}
                        />
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => setSelectedId(inquiry.id)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {inquiry.name}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {formatInquiryType(inquiry.type)} ·{" "}
                                {formatRelativeTime(inquiry.createdAt)}
                              </p>
                            </div>
                            <InquiryStatusBadge status={inquiry.status} />
                          </div>
                          {inquiry.subject ? (
                            <p className="mt-1.5 truncate text-sm text-muted-foreground">
                              {inquiry.subject}
                            </p>
                          ) : null}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <ListPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </div>

        <aside className="hidden xl:sticky xl:top-24 xl:block xl:max-h-[calc(100vh-7rem)] xl:self-start">
          <div className="flex h-full max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <InquiryDetailPanel
              inquiry={selectedInquiry}
              onUpdate={(item) => {
                refresh();
                setSelectedId(item.id);
              }}
              onDelete={(item) =>
                setDeleteTarget({
                  ids: [item.id],
                  name: item.name,
                })
              }
            />
          </div>
        </aside>
      </div>

      <MobileDetailDrawer
        open={Boolean(selectedInquiry)}
        onClose={() => setSelectedId(null)}
        title={selectedInquiry?.name ?? "Inquiry details"}
      >
        {selectedInquiry ? (
          <InquiryDetailPanel
            inquiry={selectedInquiry}
            onUpdate={(item) => {
              refresh();
              setSelectedId(item.id);
            }}
            onDelete={(item) => {
              setSelectedId(null);
              setDeleteTarget({
                ids: [item.id],
                name: item.name,
              });
            }}
          />
        ) : null}
      </MobileDetailDrawer>

      <DeleteInquiryDialog
        open={Boolean(deleteTarget)}
        name={deleteTarget?.name}
        count={deleteTarget?.ids.length}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </>
  );

  if (embedded) {
    return <div className="space-y-4 sm:space-y-5">{body}</div>;
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader title={title} description={description} className="gap-3" />
      {body}
    </AdminPage>
  );
}
