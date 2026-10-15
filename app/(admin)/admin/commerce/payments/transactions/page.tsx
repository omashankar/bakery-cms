import type { Metadata } from "next";
import { TransactionsPage } from "@/apps/admin/commerce/pages/transactions-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { asQueryParams } from "@/lib/server/http/query-params";
import { transactionsQuerySchema } from "@/features/orders/server/order.validators";
import { getTransactionsPage } from "@/features/orders/server/order.analytics";
import { defaultTransactionFilters } from "@/features/payments/lib/transactions";

export const metadata: Metadata = {
  title: "Transactions",
  description: "All payment transactions across gateways.",
};

/**
 * The first page of transactions and their totals, read with the page: the client's own default request
 * (its default filters, page 1, 12 rows), through the API's schema.
 */
export default async function Page() {
  const initial = await whenAdmin(async () => {
    const { page, limit, ...filters } = transactionsQuerySchema.parse(
      asQueryParams({ ...defaultTransactionFilters, page: 1, limit: 12 }),
    );
    return JSON.parse(JSON.stringify(await getTransactionsPage(filters, page, limit)));
  });
  return <TransactionsPage initial={initial} />;
}
