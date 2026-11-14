import type { Metadata } from "next";
import { InventoryAdminPage } from "@/apps/admin/commerce/pages/inventory-admin-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { getProducts } from "@/features/products/data/products-service";
import { getOverview } from "@/features/inventory/server/inventory.service";

export const metadata: Metadata = {
  title: "Inventory",
  description: "Stock levels, adjustments, and low-stock alerts.",
};

/** The catalogue and the stock overview, read with the page. */
export default async function Page() {
  const initial = await whenAllowed("inventory.view", async () => {
    const [products, overview] = await Promise.all([getProducts(), getOverview()]);
    return JSON.parse(JSON.stringify({ products, overview }));
  });
  return <InventoryAdminPage initial={initial} />;
}
