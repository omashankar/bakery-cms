import type { Metadata } from "next";
import { InventoryAdminPage } from "@/apps/admin/commerce/pages/inventory-admin-page";

export const metadata: Metadata = {
  title: "Inventory",
  description: "Stock levels, adjustments, and low-stock alerts.",
};

export default function Page() {
  return <InventoryAdminPage />;
}
