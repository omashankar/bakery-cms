"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Download,
  IndianRupee,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/features/admin/products/components/admin-field";
import { CustomerSegmentBadge } from "@/features/admin/commerce/components/customer-segment-badge";
import {
  FilterPanel,
  FilterPanelSearch,
  FilterPanelToolbar,
} from "@/components/shared/filter-panel";
import { ensureDemoOrders } from "@/features/admin/commerce/lib/order-utils";
import { CUSTOMERS_UPDATED_EVENT } from "@/features/admin/commerce/lib/customers-repository";
import {
  defaultCustomerFilters,
  exportCustomersToCsv,
  filterCustomerProfiles,
  formatCustomerSegmentLabel,
  getCustomerProfiles,
  getCustomerSegmentStats,
  type CustomerListFilters,
  type CustomerProfile,
} from "@/features/admin/commerce/lib/customer-profile-utils";
import { DashboardStatCard } from "@/features/admin/dashboard/components/dashboard-stat-card";
import { AdminPage, AdminPageHeader, adminShell } from "@/features/admin/components";
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
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [filters, setFilters] = useState<CustomerListFilters>(defaultCustomerFilters);
  const [page, setPage] = useState(1);

  useEffect(() => {
    function refresh() {
      ensureDemoOrders();
      setCustomers(getCustomerProfiles());
      setMounted(true);
    }

    refresh();
    window.addEventListener("bakery-orders-updated", refresh);
    window.addEventListener(CUSTOMERS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener("bakery-orders-updated", refresh);
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
          />
        </button>
        <DashboardStatCard
          title="Lifetime revenue"
          value={formatCurrency(totalRevenue)}
          change="From all customers"
          changeTone="neutral"
          icon={IndianRupee}
          tone="gold"
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
        {paginated.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No customers found"
            description="Try another filter, or wait for new storefront orders."
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
