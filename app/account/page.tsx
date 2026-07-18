import type { Metadata } from "next";
import { AccountDashboardPage } from "@/apps/website/account/pages/account-dashboard-page";

export const metadata: Metadata = {
  title: "My Account",
  description: "Manage your bakery account, orders, and preferences.",
};

export default function Page() {
  return <AccountDashboardPage />;
}
