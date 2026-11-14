import type { Metadata } from "next";
import { CustomersListPage } from "@/apps/admin/commerce/pages/customers-list-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { getCustomers } from "@/features/customers/server/customers.service";

export const metadata: Metadata = {
  title: "Customers",
  description: "View customers aggregated from storefront orders.",
};

/** The customer list in the HTML; same read as GET /api/customers. */
export default async function Page() {
  const initial = await whenAllowed("customers.view", async () =>
    JSON.parse(JSON.stringify(await getCustomers())),
  );
  return <CustomersListPage initial={initial} />;
}
