import type { Metadata } from "next";
import { CatalogAdminPage } from "@/apps/admin/catalog";

export const metadata: Metadata = {
  title: "Catalog",
  description: "Manage categories, occasions, flavours, and weight options.",
};

export default function Page() {
  return <CatalogAdminPage />;
}
