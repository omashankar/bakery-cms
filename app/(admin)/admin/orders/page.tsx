import type { Metadata } from "next";
import { OrdersListPage } from "@/features/admin/commerce/pages/orders-list-page";

export const metadata: Metadata = {
  title: "Orders",
  description: "Manage and fulfill customer orders.",
};

export default function Page() {
  return <OrdersListPage />;
}
