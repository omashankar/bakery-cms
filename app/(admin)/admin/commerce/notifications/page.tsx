import type { Metadata } from "next";
import { NotificationsAdminPage } from "@/apps/admin/commerce/pages/notifications-admin-page";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Order alerts, low stock, and admin notification center.",
};

export default function Page() {
  return <NotificationsAdminPage />;
}
