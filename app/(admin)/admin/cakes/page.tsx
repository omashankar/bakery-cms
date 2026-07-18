import type { Metadata } from "next";
import { ProductsListPage } from "@/apps/admin/products";

export const metadata: Metadata = {
  title: "Cakes",
  description: "Manage all cakes with search, filters, and pagination.",
};

export default function Page() {
  return <ProductsListPage />;
}
