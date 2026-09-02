import type { Metadata } from "next";
import { getServerLabels } from "@/features/settings/server/labels.server";
import { ProductsListPage } from "@/apps/admin/products";

export async function generateMetadata(): Promise<Metadata> {
  const { productWordPlural } = await getServerLabels();
  const lower = productWordPlural.toLowerCase();
  return {
    title: productWordPlural,
    description: `Manage all ${lower} with search, filters, and pagination.`,
  };
}

export default function Page() {
  return <ProductsListPage />;
}
