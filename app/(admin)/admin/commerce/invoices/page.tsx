import type { Metadata } from "next";
import { InvoicesAdminPage } from "@/apps/admin/commerce/pages/invoices-admin-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { asQueryParams } from "@/lib/server/http/query-params";
import { invoicesQuerySchema } from "@/features/orders/server/order.validators";
import { getInvoicesPage } from "@/features/orders/server/order.analytics";
import { defaultInvoiceListFilters } from "@/features/orders/lib/order-overviews";

export const metadata: Metadata = {
  title: "Invoices",
  description: "Manage order invoices, print documents, and customize invoice design.",
};

/**
 * The first page of invoices and their counters, read with the page: the client's own default request
 * (its default filters, page 1, 10 rows), through the API's schema.
 */
export default async function Page() {
  const initial = await whenAdmin(async () => {
    const { page, limit, ...filters } = invoicesQuerySchema.parse(
      asQueryParams({ ...defaultInvoiceListFilters, page: 1, limit: 10 }),
    );
    return JSON.parse(JSON.stringify(await getInvoicesPage(filters, page, limit)));
  });
  return <InvoicesAdminPage initial={initial} />;
}
