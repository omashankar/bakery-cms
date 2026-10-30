import type { Metadata } from "next";
import { ReportsPage } from "@/apps/admin/reports/components/reports-page";
import { DEFAULT_REPORT_RANGE } from "@/apps/admin/reports/lib/reports-defaults";
import { whenAllowed } from "@/lib/server/auth/access";
import { readOrderAnalytics } from "@/features/orders/server/order.initial";

export const metadata: Metadata = {
  title: "Reports",
  description: "Revenue, orders, products, and customer analytics.",
};

/** The default range's analytics, read with the page. */
export default async function Page() {
  const initial = await whenAllowed("reports.revenue.view", async (actor) =>
    JSON.parse(JSON.stringify(await readOrderAnalytics(DEFAULT_REPORT_RANGE, actor.permissions))),
  );
  return <ReportsPage initial={initial} />;
}
