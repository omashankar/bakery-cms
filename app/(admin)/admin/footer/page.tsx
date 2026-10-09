import type { Metadata } from "next";
import { FooterAdminPage } from "@/apps/admin/footer/components/footer-admin-page";

export const metadata: Metadata = {
  title: "Footer",
  description: "Configure footer columns and visibility.",
};

export default function Page() {
  return <FooterAdminPage />;
}
