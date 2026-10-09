import type { Metadata } from "next";
import { getServerLabels } from "@/features/settings/server/labels.server";
import { ProductsListPage } from "@/apps/admin/products/components/products-list-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { getProducts } from "@/features/products/data/products-service";
import { getCatalog } from "@/features/catalog/server/catalog.service";

export async function generateMetadata(): Promise<Metadata> {
  const { productWordPlural } = await getServerLabels();
  const lower = productWordPlural.toLowerCase();
  return {
    title: productWordPlural,
    description: `Manage all ${lower} with search, filters, and pagination.`,
  };
}

/**
 * The catalogue in the HTML, so the table paints with the page instead of
 * after the admin bundle has loaded and asked for it (7.4s on a throttled
 * phone). Same read as GET /api/products for staff.
 */
export default async function Page() {
  const initial = await whenAdmin(() => getProducts());
  // The names the rows print, from the same catalogue the browser's copy is
  // filled from — so the server's HTML and the first client render agree.
  const categories = await whenAdmin(async () =>
    ((await getCatalog()).categories as Array<{ id: string; name: string }>).map(({ id, name }) => ({ id, name })),
  );
  return <ProductsListPage initial={initial} initialCategories={categories} />;
}
