import type { Metadata } from "next";
import { RefundCenterAdminPage } from "@/features/admin/commerce/pages/refund-center-admin-page";

export const metadata: Metadata = {
  title: "Refund Center",
  description: "Manage cancellations, refund requests, and completed refunds.",
};

export default function Page() {
  return <RefundCenterAdminPage />;
}
