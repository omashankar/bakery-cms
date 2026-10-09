import type { Metadata } from "next";
import { CatalogAdminPage } from "@/apps/admin/catalog/components/catalog-admin-page";

export const metadata: Metadata = {
  title: "Catalog",
  description: "Manage categories and occasions.",
};

export default function Page() {
  return <CatalogAdminPage />;
}
