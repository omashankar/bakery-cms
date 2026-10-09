import type { Metadata } from "next";
import { HeaderAdminPage } from "@/apps/admin/header/components/header-admin-page";

export const metadata: Metadata = {
  title: "Header",
  description: "Configure storefront navigation and CTA.",
};

export default function Page() {
  return <HeaderAdminPage />;
}
