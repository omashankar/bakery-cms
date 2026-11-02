"use client";

import { MapPin, Navigation, Phone, RefreshCw, Wallet } from "lucide-react";

import { AdminPage, AdminPageHeader } from "@/apps/admin/components/admin-page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMyDeliveries } from "@/features/orders/lib/staff-orders-api";
import { deliveryMoves } from "@/features/orders/lib/staff-scope";
import type { DeliveryOrderView } from "@/features/orders/lib/staff-order-types";
import { useAccess } from "@/features/team/lib/access-context";
import { formatCurrency, formatDate } from "@/utils/format";

import { StaffMoveButton } from "./components/staff-move-button";
import { StaffOrderCard } from "./components/staff-order-card";
import { bySlot, slotUrgency, urgencyLabel, useShopToday } from "./lib/slot-urgency";
import { useStaffOrders } from "./lib/use-staff-orders";
import { announceArrivals, useArrivalAlerts } from "./lib/arrival-alert";

/** What the rider does next, first: what is in the bag, what to collect, what is still being made. */
const GROUPS = [
  { title: "On the way", statuses: ["out_for_delivery"] },
  { title: "Ready to pick up", statuses: ["ready"] },
  { title: "Being prepared", statuses: ["confirmed", "preparing"] },
] as const;

/** Sorts by slot date then time; no slot goes last. */
function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function mapsHref(order: DeliveryOrderView): string {
  const a = order.address;
  if (a.location) return `https://www.google.com/maps/dir/?api=1&destination=${a.location.lat},${a.location.lng}`;
  const text = [a.addressLine1, a.addressLine2, a.landmark, a.city, a.pincode].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(text)}`;
}

function DeliveryDetails({ order }: { order: DeliveryOrderView }) {
  const a = order.address;
  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-3 text-sm">
      <p className="font-medium text-foreground">{a.fullName}</p>
      <p className="flex gap-1.5 text-foreground">
        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          {[a.addressLine1, a.addressLine2].filter(Boolean).join(", ")}
          {a.landmark ? <><br />Near {a.landmark}</> : null}
          <br />
          {[a.city, a.pincode].filter(Boolean).join(" ")}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {a.phone ? (
          <Button size="sm" variant="outline" render={<a href={telHref(a.phone)} />} nativeButton={false}>
            <Phone className="size-4" aria-hidden />
            Call {a.phone}
          </Button>
        ) : null}
        {a.altPhone ? (
          <Button size="sm" variant="outline" render={<a href={telHref(a.altPhone)} />} nativeButton={false}>
            <Phone className="size-4" aria-hidden />
            {a.altPhone}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          render={<a href={mapsHref(order)} target="_blank" rel="noreferrer" />}
          nativeButton={false}
        >
          <Navigation className="size-4" aria-hidden />
          Directions
        </Button>
      </div>
      {order.cashToCollect > 0 ? (
        <p className="flex items-center gap-1.5 font-semibold text-foreground">
          <Wallet className="size-4 text-primary" aria-hidden />
          Collect cash: {formatCurrency(order.cashToCollect)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Already paid — nothing to collect.</p>
      )}
    </div>
  );
}

/**
 * A rider's own deliveries — only the orders assigned to them, which is all the
 * server sends. What is on its way first, then what they delivered today.
 */
export function DeliveriesPage({ initial = null }: { initial?: DeliveryOrderView[] | null } = {}) {
  // A delivery handed to this rider rings their phone, not just joins the list.
  useArrivalAlerts();
  const { orders, state, stale, lastLoaded, refresh, replace } = useStaffOrders(fetchMyDeliveries, initial, (arrived) =>
    announceArrivals(
      arrived.length === 1 ? `New delivery for you: ${arrived[0].orderNumber}` : `${arrived.length} new deliveries for you`,
      arrived.length,
    ),
  );
  const { access, can } = useAccess();
  const userId = access?.userId ?? null;
  const days = useShopToday();
  const active = orders.filter((o) => o.status !== "delivered");
  const done = orders.filter((o) => o.status === "delivered");

  return (
    <AdminPage className="space-y-4">
      <AdminPageHeader
        title="My deliveries"
        description="Orders assigned to you. Updates by itself every minute."
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
          Your deliveries could not be loaded. Check the connection and press Refresh.
        </p>
      ) : null}

      {state === "loading" ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : state === "ready" && active.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing assigned to you right now.
        </p>
      ) : (
        GROUPS.map((group) => {
          const inGroup = active
            .filter((o) => (group.statuses as readonly string[]).includes(o.status))
            // Soonest slot first — the round is planned by the clock.
            .sort(bySlot);
          if (inGroup.length === 0) return null;
          return (
            <section key={group.title} className="space-y-3" aria-label={group.title}>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {group.title}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground">
                  {inGroup.length}
                </span>
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {inGroup.map((order) => {
                  // Every order on this list is assigned to this rider — the
                  // server sends nothing else — so the view does not repeat their id.
                  const moves = deliveryMoves(
                    { status: order.status, deliveryPartner: { userId: userId ?? undefined } },
                    userId,
                  );
                  const urgency = order.status === "out_for_delivery" ? null : slotUrgency(order.deliverySlot, days);
                  return (
                    <StaffOrderCard
                      key={order.id}
                      order={order}
                      urgency={urgency}
                      urgencyText={urgency ? urgencyLabel(urgency, order.deliverySlot, days) : ""}
                      footer={
                        !can("orders.update_status") ? null : moves.length > 0 ? (
                          moves.map((to) => (
                            <StaffMoveButton<DeliveryOrderView>
                              key={to}
                              order={order}
                              to={to}
                              onMoved={replace}
                              primary
                            />
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            You can pick this up once the kitchen marks it ready.
                          </p>
                        )
                      }
                    >
                      <DeliveryDetails order={order} />
                    </StaffOrderCard>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {done.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Delivered today</h2>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card text-sm">
            {done.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                <span className="font-mono">{order.orderNumber}</span>
                <span className="text-muted-foreground">{order.address.fullName}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AdminPage>
  );
}
