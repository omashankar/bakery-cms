import type { Metadata } from "next";
import { InventoryAdminPage } from "@/features/admin/commerce/pages/inventory-admin-page";

export const metadata: Metadata = {
  title: "Inventory",
  description: "Stock levels, adjustments, and low-stock alerts.",
};

export default function Page() {
  return <InventoryAdminPage />;
}
