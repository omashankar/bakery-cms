import type { Metadata } from "next";
import { AccountOrdersPage } from "@/apps/website/account/pages/account-orders-page";

export const metadata: Metadata = {
  title: "My Orders",
  description: "View and track your orders.",
};

export default function Page() {
  return <AccountOrdersPage />;
}
