"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  MessageSquare,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import { DashboardStatCard } from "@/apps/admin/dashboard/components/dashboard-stat-card";
import {
  FilterPanel,
  FilterPanelSearch,
  FilterPanelToolbar,
} from "@/components/shared/filter-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { NotificationListItem } from "@/apps/admin/commerce/components/notification-list-item";
import { INVENTORY_UPDATED_EVENT } from "@/apps/admin/commerce/lib/inventory-repository";
import {
  defaultNotificationFilters,
  filterNotifications,
  formatNotificationType,
  groupNotificationsByDay,
} from "@/apps/admin/commerce/lib/notification-utils";
import {
  clearReadNotifications,
  defaultNotificationSettings,
  dismissNotification,
  getNotificationOverview,
  getNotificationSettings,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_UPDATED_EVENT,
  saveNotificationSettings,
  syncNotifications,
} from "@/apps/admin/commerce/lib/notifications-repository";
import { INQUIRIES_UPDATED_EVENT } from "@/features/inquiries/lib/inquiries-repository";
import type {
  NotificationListFilters,
  NotificationOverview,
  NotificationSettings,
  NotificationType,
} from "@/types/notification";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 12;

const EMPTY_OVERVIEW: NotificationOverview = {
  total: 0,
  unread: 0,
  orderCount: 0,
  paymentCount: 0,
  stockCount: 0,
  inquiryCount: 0,
};

const typeOptions = [
  "all",
  "order_placed",
  "payment_received",
  "payment_failed",
  "low_stock",
  "out_of_stock",
  "inquiry_new",
  "system",
] as const;

const preferenceItems = [
  {
    key: "orderAlerts" as const,
    label: "New orders",
    description: "Orders from the last 30 days",
  },
  {
    key: "paymentAlerts" as const,
    label: "Payments",
    description: "Online payments received or failed",
  },
  {
    key: "stockAlerts" as const,
    label: "Stock alerts",
    description: "Low stock and out-of-stock products",
  },
  {
    key: "inquiryAlerts" as const,
    label: "Inquiries",
    description: "Contact, wedding, and newsletter",
  },
];

export function NotificationsAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState<NotificationListFilters>(defaultNotificationFilters);
  const [page, setPage] = useState(1);
  const [settings, setSettings] = useState<NotificationSettings>(defaultNotificationSettings);
  const [savedSettings, setSavedSettings] = useState<NotificationSettings>(
    defaultNotificationSettings
  );

  const notifications = useMemo(
    () => (mounted ? loadNotifications() : []),
    [mounted, refreshKey]
  );
  const overview = useMemo(
    () => (mounted ? getNotificationOverview() : EMPTY_OVERVIEW),
    [mounted, refreshKey]
  );
  const filtered = useMemo(
    () => filterNotifications(notifications, filters),
    [notifications, filters]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const grouped = useMemo(() => groupNotificationsByDay(paginated), [paginated]);
  const settingsDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  useEffect(() => {
    function refresh() {
      syncNotifications();
      setRefreshKey((value) => value + 1);
      const loaded = getNotificationSettings();
      setSettings(loaded);
      setSavedSettings(loaded);
      setMounted(true);
    }

    refresh();
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    window.addEventListener("bakery-orders-updated", refresh);
    window.addEventListener(INVENTORY_UPDATED_EVENT, refresh);
    window.addEventListener(INQUIRIES_UPDATED_EVENT, refresh);

    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
      window.removeEventListener("bakery-orders-updated", refresh);
      window.removeEventListener(INVENTORY_UPDATED_EVENT, refresh);
      window.removeEventListener(INQUIRIES_UPDATED_EVENT, refresh);
    };
  }, []);

  function updateFilters(patch: Partial<NotificationListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function filterByType(type: NotificationType) {
    updateFilters({ type, status: "all", search: "" });
  }

  function bump() {
    setRefreshKey((value) => value + 1);
  }

  function handleSaveSettings() {
    const saved = saveNotificationSettings(settings);
    setSettings(saved);
    setSavedSettings(saved);
    bump();
    toast.success("Notification preferences saved");
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Notifications"
        description="Orders, payments, stock, and inquiry alerts."
        className="gap-3"
        actions={
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className="min-w-0 flex-1 sm:flex-none"
              onClick={() => {
                const cleared = clearReadNotifications();
                bump();
                toast.success(
                  cleared > 0 ? `Cleared ${cleared} read alert(s)` : "No read alerts to clear"
                );
              }}
            >
              <Trash2 className="size-4" />
              <span className="sm:hidden">Clear</span>
              <span className="hidden sm:inline">Clear read</span>
            </Button>
            <Button
              variant="bakery"
              className="min-w-0 flex-1 sm:flex-none"
              onClick={() => {
                markAllNotificationsRead();
                bump();
                toast.success("All notifications marked as read");
              }}
              disabled={overview.unread === 0}
            >
              <CheckCheck className="size-4" />
              <span className="sm:hidden">Mark read</span>
              <span className="hidden sm:inline">Mark all read</span>
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "unread", type: "all", search: "" })}
        >
          <DashboardStatCard
            title="Unread"
            value={overview.unread}
            change={overview.unread > 0 ? "Needs attention" : "All clear"}
            changeTone={overview.unread > 0 ? "warning" : "positive"}
            icon={Bell}
            tone="gold"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => filterByType("order_placed")}
        >
          <DashboardStatCard
            title="Orders"
            value={overview.orderCount}
            change="New order alerts"
            changeTone="neutral"
            icon={ShoppingBag}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => filterByType("low_stock")}
        >
          <DashboardStatCard
            title="Stock"
            value={overview.stockCount}
            change={overview.stockCount > 0 ? "Needs restock" : "Stock healthy"}
            changeTone={overview.stockCount > 0 ? "warning" : "positive"}
            icon={AlertTriangle}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => filterByType("inquiry_new")}
        >
          <DashboardStatCard
            title="Inquiries"
            value={overview.inquiryCount}
            change="Customer messages"
            changeTone="neutral"
            icon={MessageSquare}
            tone="bakery"
          />
        </button>
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,300px)]">
        <div className="min-w-0 space-y-4">
          <FilterPanel>
            <FilterPanelToolbar className="gap-2.5 sm:flex-row sm:items-center">
              <FilterPanelSearch
                value={filters.search}
                onChange={(value) => updateFilters({ search: value })}
                placeholder="Search notifications..."
              />
              <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                <AdminSelect
                  className="w-full sm:w-36"
                  value={filters.status}
                  onChange={(event) =>
                    updateFilters({
                      status: event.target.value as NotificationListFilters["status"],
                    })
                  }
                  aria-label="Notification status"
                >
                  <option value="all">All status</option>
                  <option value="unread">Unread</option>
                  <option value="read">Read</option>
                </AdminSelect>
                <AdminSelect
                  className="w-full sm:w-44"
                  value={filters.type}
                  onChange={(event) =>
                    updateFilters({
                      type: event.target.value as NotificationListFilters["type"],
                    })
                  }
                  aria-label="Notification type"
                >
                  {typeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type === "all" ? "All types" : formatNotificationType(type)}
                    </option>
                  ))}
                </AdminSelect>
              </div>
            </FilterPanelToolbar>
          </FilterPanel>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No notifications"
              description="Alerts matching your filters will appear here."
            />
          ) : (
            <div className="space-y-5">
              {grouped.map((group) => (
                <section key={group.label} className="space-y-2.5">
                  <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    {group.label}
                  </h2>
                  <div className="space-y-2.5">
                    {group.items.map((notification) => (
                      <NotificationListItem
                        key={notification.id}
                        notification={notification}
                        onMarkRead={(id) => {
                          markNotificationRead(id);
                          bump();
                        }}
                        onDismiss={(id) => {
                          dismissNotification(id);
                          bump();
                          toast.success("Notification dismissed");
                        }}
                      />
                    ))}
                  </div>
                </section>
              ))}

              <ListPagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>

        <Card className="h-fit shadow-sm lg:sticky lg:top-24">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Alert preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-0">
            {preferenceItems.map((item) => (
              <label
                key={item.key}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5",
                  "transition-colors hover:border-border"
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </div>
                <Switch
                  checked={settings[item.key]}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, [item.key]: checked === true }))
                  }
                />
              </label>
            ))}

            <Button
              variant="bakery"
              className="w-full"
              onClick={handleSaveSettings}
              disabled={!settingsDirty}
            >
              Save preferences
            </Button>
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}
