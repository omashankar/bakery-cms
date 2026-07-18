import type { Metadata } from "next";
import { PaymentNotificationsPage } from "@/apps/admin/commerce/pages/payment-notifications-page";

export const metadata: Metadata = {
  title: "Payment Notifications",
  description: "Payment notification templates and delivery preferences.",
};

export default function Page() {
  return <PaymentNotificationsPage />;
}
