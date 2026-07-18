import type { Metadata } from "next";
import { PaymentsAdminPage } from "@/apps/admin/commerce/pages/payments-admin-page";

export const metadata: Metadata = {
  title: "Payments",
  description: "Payment methods and checkout payment options.",
};

export default function Page() {
  return <PaymentsAdminPage />;
}
