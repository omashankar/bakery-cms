import type { Metadata } from "next";
import { RefundCenterAdminPage } from "@/apps/admin/commerce/pages/refund-center-admin-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { asQueryParams } from "@/lib/server/http/query-params";
import { refundCasesQuerySchema } from "@/features/orders/server/order.validators";
import { getRefundCasesPage } from "@/features/orders/server/order.analytics";
import { defaultRefundFilters } from "@/features/orders/lib/order-overviews";

export const metadata: Metadata = {
  title: "Refund Center",
  description: "Manage cancellations, refund requests, and completed refunds.",
};

/**
 * The first page of refund cases and their counters, read with the page: the client's own default request
 * (its default filters, page 1, 8 rows), through the API's schema.
 */
export default async function Page() {
  const initial = await whenAdmin(async () => {
    const { page, limit, ...filters } = refundCasesQuerySchema.parse(
      asQueryParams({ ...defaultRefundFilters, page: 1, limit: 8 }),
    );
    return JSON.parse(JSON.stringify(await getRefundCasesPage(filters, page, limit)));
  });
  return <RefundCenterAdminPage initial={initial} />;
}
