"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChefHat, Clock, Inbox, RefreshCw } from "lucide-react";

import { AdminPage, AdminPageHeader } from "@/apps/admin/components/admin-page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchKitchenQueue } from "@/features/orders/lib/staff-orders-api";
import { kitchenMoves } from "@/features/orders/lib/staff-scope";
import type { KitchenOrderView } from "@/features/orders/lib/staff-order-types";
import { useCan } from "@/features/team/lib/access-context";
import { formatDate } from "@/utils/format";
import { cn } from "@/lib/utils";

import { StaffMoveButton } from "./components/staff-move-button";
import { StaffOrderCard } from "./components/staff-order-card";
import { bySlot, slotUrgency, urgencyLabel, useShopToday } from "./lib/slot-urgency";
import { useStaffOrders } from "./lib/use-staff-orders";

const COLUMNS = [
  { status: "confirmed", title: "To start", empty: "Nothing waiting to be started.", dot: "bg-amber-500", icon: Inbox },
  { status: "preparing", title: "Preparing", empty: "Nothing in progress.", dot: "bg-sky-500", icon: ChefHat },
  { status: "ready", title: "Ready", empty: "Nothing waiting to be collected.", dot: "bg-emerald-500", icon: CheckCircle2 },
] as const;

type Step = (typeof COLUMNS)[number]["status"];

/**
 * The kitchen's screen: what to make and in what order, and the next step on
 * each order. One step at a time — To start, Preparing, Ready — as tabs that
 * carry their counts, so a tablet or a phone shows whole cards side by side
 * instead of three squeezed columns. Soonest delivery first; refreshes itself.
 */
export function KitchenPage({ initial = null }: { initial?: KitchenOrderView[] | null } = {}) {
  const { orders, state, stale, lastLoaded, refresh, replace } = useStaffOrders(fetchKitchenQueue, initial);
  const canMove = useCan("orders.update_status");
  const clock = useShopToday();
  // Until someone picks a tab, open the first step that has work in it.
  const [picked, setPicked] = useState<Step | null>(null);

  const loading = state === "loading";
  const inStep = (status: Step) => orders.filter((o) => o.status === status).sort(bySlot);
  const tab: Step = picked ?? COLUMNS.find((c) => inStep(c.status).length > 0)?.status ?? "confirmed";

  // A cake that is ready is made; "late" is about what is still to make.
  const open = orders.filter((o) => o.status !== "ready");
  const late = open.filter((o) => slotUrgency(o.deliverySlot, clock) === "overdue").length;
  const dueToday = open.filter((o) => slotUrgency(o.deliverySlot, clock) === "today").length;

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Kitchen"
        description="What to make, soonest delivery first. Updates by itself every minute."
        status={
          stale
            ? "Couldn't refresh — showing the last list"
            : lastLoaded
              ? `Updated ${formatDate(lastLoaded, { hour: "numeric", minute: "2-digit" })}`
              : undefined
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw className="size-4" aria-hidden />
            Refresh
          </Button>
        }
      />

      {state === "error" ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          The kitchen queue could not be loaded. Check the connection and press Refresh.
        </p>
      ) : null}

      <Tabs value={tab} onValueChange={(value) => setPicked(value as Step)} className="gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-full group-data-horizontal/tabs:h-10 sm:w-fit">
            {COLUMNS.map((column) => (
              <TabsTrigger key={column.status} value={column.status} className="gap-2 px-3">
                <span className={cn("size-2 rounded-full", column.dot)} aria-hidden />
                {column.title}
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                  {loading ? "…" : inStep(column.status).length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {clock && !loading ? (
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium" aria-label="Kitchen summary">
              {late > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-destructive">
                  <AlertTriangle className="size-3.5" aria-hidden />
                  {late} late
                </span>
              ) : null}
              {dueToday > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300">
                  <Clock className="size-3.5" aria-hidden />
                  {dueToday} due today
                </span>
              ) : null}
              {late === 0 && dueToday === 0 && open.length > 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  Nothing late
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        {COLUMNS.map((column) => {
          const list = inStep(column.status);
          const Icon = column.icon;
          return (
            <TabsContent key={column.status} value={column.status}>
              {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  <Skeleton className="h-56 w-full rounded-xl" />
                  <Skeleton className="hidden h-56 w-full rounded-xl sm:block" />
                </div>
              ) : list.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-12 text-center text-sm text-muted-foreground">
                  <Icon className="size-5" aria-hidden />
                  {column.empty}
                </div>
              ) : (
                <div className="grid items-start gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {list.map((order) => {
                    const urgency = order.status === "ready" ? null : slotUrgency(order.deliverySlot, clock);
                    const moves = canMove ? kitchenMoves(order) : [];
                    return (
                      <StaffOrderCard
                        key={order.id}
                        order={order}
                        showStatus={false}
                        urgency={urgency}
                        urgencyText={urgency ? urgencyLabel(urgency, order.deliverySlot, clock) : ""}
                        footer={
                          moves.length > 0
                            ? moves.map((to, index) => (
                                <StaffMoveButton<KitchenOrderView>
                                  key={to}
                                  order={order}
                                  to={to}
                                  onMoved={replace}
                                  // The next step leads; skipping straight to Ready stays possible.
                                  primary={index === 0}
                                />
                              ))
                            : null
                        }
                      />
                    );
                  })}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </AdminPage>
  );
}
