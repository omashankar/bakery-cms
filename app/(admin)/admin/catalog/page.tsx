import type { Metadata } from "next";
import { CatalogAdminPage } from "@/apps/admin/catalog";

export const metadata: Metadata = {
  title: "Catalog",
  description: "Manage categories and occasions.",
};

export default function Page() {
  return <CatalogAdminPage />;
}
