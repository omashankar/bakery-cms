import type { Metadata } from "next";
import { ReportsPage } from "@/apps/admin/reports/components/reports-page";
import { DEFAULT_REPORT_RANGE } from "@/apps/admin/reports/lib/reports-defaults";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { readOrderAnalytics } from "@/features/orders/server/order.initial";

export const metadata: Metadata = {
  title: "Reports",
  description: "Revenue, orders, products, and customer analytics.",
};

/** The default range's analytics, read with the page. */
export default async function Page() {
  const initial = await whenAdmin(async () =>
    JSON.parse(JSON.stringify(await readOrderAnalytics(DEFAULT_REPORT_RANGE))),
  );
  return <ReportsPage initial={initial} />;
}
