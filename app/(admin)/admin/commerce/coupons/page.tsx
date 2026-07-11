import type { Metadata } from "next";
import { CouponsAdminPage } from "@/features/admin/commerce/pages/coupons-admin-page";

export const metadata: Metadata = {
  title: "Coupons",
  description: "Manage discount coupon codes.",
};

export default function Page() {
  return <CouponsAdminPage />;
}
