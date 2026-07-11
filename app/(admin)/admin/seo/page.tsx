import type { Metadata } from "next";
import { SeoAdminPage } from "@/features/admin/seo";

export const metadata: Metadata = {
  title: "SEO",
  description: "Manage meta titles, descriptions, and Open Graph settings.",
};

export default function Page() {
  return <SeoAdminPage />;
}
