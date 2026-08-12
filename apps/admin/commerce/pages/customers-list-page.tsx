"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Download,
  IndianRupee,
  Loader2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { CustomerSegmentBadge } from "@/apps/admin/commerce/components/customer-segment-badge";
import {
  FilterPanel,
  FilterPanelSearch,
  FilterPanelToolbar,
} from "@/components/shared/filter-panel";
import { CUSTOMERS_UPDATED_EVENT } from "@/apps/admin/commerce/lib/customers-repository";
import { fetchCustomerProfiles } from "@/apps/admin/commerce/lib/customers-api";
import {
  defaultCustomerFilters,
  exportCustomersToCsv,
  filterCustomerProfiles,
  formatCustomerSegmentLabel,  getCustomerSegmentStats,
  type CustomerListFilters,
  type CustomerProfile,
} from "@/apps/admin/commerce/lib/customer-profile-utils";
import { DashboardStatCard } from "@/apps/admin/dashboard/components/dashboard-stat-card";
import { type FiguresState } from "@/components/shared/panel-loading";
import { AdminPage, AdminPageHeader, adminShell } from "@/apps/admin/components";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { routes } from "@/constants/routes";
import { formatCurrency, formatRelativeTime } from "@/utils/format";

const PAGE_SIZE = 10;

const EMPTY_STATS = {
  total: 0,
  vip: 0,
  new: 0,
  atRisk: 0,
  marketingOptIn: 0,
};

const segmentOptions = ["all", "new", "returning", "vip", "at_risk", "inactive"] as const;

export function CustomersListPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [filters, setFilters] = useState<CustomerListFilters>(defaultCustomerFilters);
  const [page, setPage] = useState(1);

  // A customer is the sum of their orders, so this cannot be built from the
  // browser's order cache — that only ever holds the most recent slice, which
  // silently drops older customers and understates everyone else's spend.
  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      const result = await fetchCustomerProfiles();
      if (cancelled) return;
      if (result) setCustomers(result);
      setFailed(!result);
      // Settled either way — otherwise a failed request leaves the table
      // spinning forever instead of admitting it has nothing to show.
      setMounted(true);
    }

    void refresh();
    window.addEventListener(CUSTOMERS_UPDATED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(CUSTOMERS_UPDATED_EVENT, refresh);
    };
  }, []);

  const filtered = useMemo(
    () => filterCustomerProfiles(customers, filters),
    [customers, filters]
  );
  const stats = useMemo(
    () => (mounted ? getCustomerSegmentStats(customers) : EMPTY_STATS),
    [customers, mounted]
  );
  const totalRevenue = useMemo(
    () => (mounted ? customers.reduce((sum, customer) => sum + customer.totalSpent, 0) : 0),
    [customers, mounted]
  );
  /**
   * The stat cards state three things about the shop's customers, and before
   * this request answered they stated all three as zero: Total 0, Lifetime
   * revenue ₹0.00, and "At risk 0" captioned "All clear" in green. The figures
   * were already held back to EMPTY_STATS until `mounted`, which is exactly the
   * moment the zeroes went on screen — it kept them from being WRONG, not from
   * being STATED.
   */
  const figures: FiguresState = !mounted ? "loading" : failed ? "unavailable" : "ready";

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function updateFilters(patch: Partial<CustomerListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function openCustomer(id: string) {
    router.push(routes.admin.customers.detail(encodeURIComponent(id)));
  }

  function handleExport() {
    if (filtered.length === 0) {
      toast.error("No customers to export");
      return;
    }
    exportCustomersToCsv(filtered);
    toast.success(`Exported ${filtered.length} customer${filtered.length === 1 ? "" : "s"}`);
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Customers"
        description="Manage customer accounts."
        className="gap-3"
        actions={
          <Button
            variant="bakery"
            className="w-full sm:w-auto"
            onClick={handleExport}
            disabled={filtered.length === 0}
          >
            <Download className="size-4" />
            <span className="sm:hidden">Export</span>
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ segment: "all", spend: "all", search: "" })}
        >
          <DashboardStatCard
            title="Total"
            value={stats.total}
            change="All customers"
            changeTone="neutral"
            icon={Users}
            tone="bakery"
            figures={figures}
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ segment: "at_risk" })}
        >
          <DashboardStatCard
            title="At risk"
            value={stats.atRisk}
            change={stats.atRisk > 0 ? "Needs follow-up" : "All clear"}
            changeTone={stats.atRisk > 0 ? "warning" : "positive"}
            icon={AlertTriangle}
            tone="neutral"
            figures={figures}
          />
        </button>
        <DashboardStatCard
          title="Lifetime revenue"
          value={formatCurrency(totalRevenue)}
          change="From all customers"
          changeTone="neutral"
          icon={IndianRupee}
          tone="gold"
          figures={figures}
        />
      </section>

      <FilterPanel>
        <FilterPanelToolbar className="gap-2.5 sm:flex-row sm:items-center">
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search name, email, phone, city…"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
            <AdminSelect
              className="w-full sm:w-40"
              value={filters.segment}
              onChange={(event) =>
                updateFilters({
                  segment: event.target.value as CustomerListFilters["segment"],
                })
              }
              aria-label="Customer segment"
            >
              {segmentOptions.map((segment) => (
                <option key={segment} value={segment}>
                  {segment === "all" ? "All segments" : formatCustomerSegmentLabel(segment)}
                </option>
              ))}
            </AdminSelect>
            <AdminSelect
              className="w-full sm:w-40"
              value={filters.spend}
              onChange={(event) =>
                updateFilters({
                  spend: event.target.value as CustomerListFilters["spend"],
                })
              }
              aria-label="Spend level"
            >
              <option value="all">All spend</option>
              <option value="under_1k">Under ₹1,000</option>
              <option value="1k_5k">₹1,000 – ₹5,000</option>
              <option value="over_5k">Over ₹5,000</option>
            </AdminSelect>
          </div>
        </FilterPanelToolbar>
      </FilterPanel>

      <section className={adminShell.tableCard}>
        {paginated.length === 0 && !mounted ? (
          // Saying "No customers found" before the server has answered would be
          // a guess, and a wrong one on every cold load in a shop that has them.
          <div className="flex min-h-48 items-center justify-center py-14">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <span className="sr-only">Loading customers</span>
          </div>
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={Users}
            title={failed ? "Could not load customers" : "No customers found"}
            description={
              failed
                ? "The server did not answer. Check your connection and reload."
                : "Try another filter, or wait for new storefront orders."
            }
            className="py-14"
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Segment</th>
                    <th className="px-4 py-3 font-medium">Orders</th>
                    <th className="px-4 py-3 font-medium">AOV</th>
                    <th className="px-4 py-3 font-medium">Total spent</th>
                    <th className="px-4 py-3 font-medium">Last order</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((customer) => (
                    <tr
                      key={customer.id}
                      className="cursor-pointer border-b border-border/70 transition-colors hover:bg-muted"
                      onClick={() => openCustomer(customer.id)}
                    >
                      <td className="max-w-[220px] px-4 py-3">
                        <p className="truncate font-medium text-foreground">{customer.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{customer.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <CustomerSegmentBadge segment={customer.segment} />
                      </td>
                      <td className="px-4 py-3">{customer.orderCount}</td>
                      <td className="px-4 py-3">{formatCurrency(customer.averageOrderValue)}</td>
                      <td className="px-4 py-3 font-semibold">
                        {formatCurrency(customer.totalSpent)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {formatRelativeTime(customer.lastOrderAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border lg:hidden">
              {paginated.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-3 p-3 text-left sm:p-4"
                    onClick={() => openCustomer(customer.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {customer.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {customer.email} · {formatRelativeTime(customer.lastOrderAt)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <CustomerSegmentBadge segment={customer.segment} />
                        <span className="text-xs text-muted-foreground">
                          {customer.orderCount} order{customer.orderCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-semibold">
                      {formatCurrency(customer.totalSpent)}
                    </p>
                  </button>
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
    </AdminPage>
  );
}
