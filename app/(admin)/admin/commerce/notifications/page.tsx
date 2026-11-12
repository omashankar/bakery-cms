import type { Metadata } from "next";
import { NotificationsAdminPage } from "@/apps/admin/commerce/pages/notifications-admin-page";
import { whenStaff } from "@/lib/server/auth/access";
import { readCommunicationsForAdmin } from "@/features/communications/server/communications.initial";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Order alerts, low stock, and admin notification center.",
};

/** Templates and notification settings, read with the page. */
export default async function Page() {
  const initial = await whenStaff(async (actor) =>
    JSON.parse(JSON.stringify(await readCommunicationsForAdmin(actor))),
  );
  return <NotificationsAdminPage initial={initial} />;
}
