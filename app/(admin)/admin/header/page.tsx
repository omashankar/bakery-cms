import type { Metadata } from "next";
import { HeaderAdminPage } from "@/apps/admin/header";

export const metadata: Metadata = {
  title: "Header",
  description: "Configure storefront navigation and CTA.",
};

export default function Page() {
  return <HeaderAdminPage />;
}
