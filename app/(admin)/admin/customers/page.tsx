import type { Metadata } from "next";
import { CustomersListPage } from "@/features/admin/commerce/pages/customers-list-page";

export const metadata: Metadata = {
  title: "Customers",
  description: "View customers aggregated from storefront orders.",
};

export default function Page() {
  return <CustomersListPage />;
}
