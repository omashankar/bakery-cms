import type { Metadata } from "next";
import { DeliveriesPage } from "@/apps/admin/fulfilment/deliveries-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { getAssignedDeliveries } from "@/features/orders/server/order.service";
import { DELIVERED_VISIBLE_FOR_MS, DELIVERY_ACTIVE_STATUSES } from "@/features/orders/lib/staff-scope";
import { toDeliveryView } from "@/features/orders/server/staff-views";

export const metadata: Metadata = {
  title: "My deliveries",
  description: "The orders assigned to you for delivery.",
};

/** Delivered orders from the last day stay on the list. */
function deliveredSince(): string {
  return new Date(Date.now() - DELIVERED_VISIBLE_FOR_MS).toISOString();
}

/** This rider's own deliveries in the HTML — the assignment decides, nothing else. */
export default async function Page() {
  const initial = await whenAllowed("orders.view_assigned", async (actor) => {
    const orders = await getAssignedDeliveries(actor.sub, DELIVERY_ACTIVE_STATUSES, deliveredSince());
    return JSON.parse(JSON.stringify(orders.map(toDeliveryView)));
  });
  return <DeliveriesPage initial={initial} />;
}
