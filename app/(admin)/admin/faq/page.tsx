import type { Metadata } from "next";
import { FaqAdminPage } from "@/apps/admin/faq/components/faq-admin-page";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Manage frequently asked questions for the storefront.",
};

export default function Page() {
  return <FaqAdminPage />;
}
