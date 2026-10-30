import type { Metadata } from "next";
import { KitchenPage } from "@/apps/admin/fulfilment/kitchen-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { getKitchenQueue } from "@/features/orders/server/order.service";
import { KITCHEN_QUEUE_STATUSES } from "@/features/orders/lib/staff-scope";
import { toKitchenView } from "@/features/orders/server/staff-views";

export const metadata: Metadata = {
  title: "Kitchen",
  description: "Orders to make, and marking them started and ready.",
};

/** The queue in the HTML — the kitchen's view of each order, never the full one. */
export default async function Page() {
  const initial = await whenAllowed("orders.view_kitchen", async () =>
    JSON.parse(JSON.stringify((await getKitchenQueue(KITCHEN_QUEUE_STATUSES)).map(toKitchenView))),
  );
  return <KitchenPage initial={initial} />;
}
