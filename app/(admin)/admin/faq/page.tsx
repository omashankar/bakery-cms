import type { Metadata } from "next";
import { FaqAdminPage } from "@/apps/admin/faq";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Manage frequently asked questions for the storefront.",
};

export default function Page() {
  return <FaqAdminPage />;
}
