import type { Metadata } from "next";
import { OrdersListPage } from "@/apps/admin/commerce/pages/orders-list-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { getOrdersPage, getStats } from "@/features/orders/server/order.service";
import { orderQuerySchema } from "@/features/orders/server/order.validators";

export const metadata: Metadata = {
  title: "Orders",
  description: "Manage and fulfill customer orders.",
};

/**
 * The first page of orders and the counters, in the HTML.
 *
 * The list is what this screen is for, and it used to appear only after the
 * admin bundle had loaded and asked for it — 7.1s on a throttled phone. The
 * query is the client's own default (every order, page 1, ten rows), parsed by
 * the same schema the API uses so the two cannot disagree.
 */
export default async function Page() {
  const initial = await whenAdmin(async () => {
    const query = orderQuerySchema.parse({ page: "1", limit: "10" });
    const [{ items, total }, stats] = await Promise.all([getOrdersPage(query), getStats()]);
    return { orders: items, total, stats };
  });
  return <OrdersListPage initial={initial} />;
}
