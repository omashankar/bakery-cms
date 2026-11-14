import type { Metadata } from "next";
import { CatalogAdminPage } from "@/apps/admin/catalog/components/catalog-admin-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { getCatalog } from "@/features/catalog/server/catalog.service";

export const metadata: Metadata = {
  title: "Catalog",
  description: "Manage categories and occasions.",
};

/** The whole taxonomy, read with the page. */
export default async function Page() {
  const initial = await whenAllowed("catalog.manage", async () => JSON.parse(JSON.stringify(await getCatalog())));
  return <CatalogAdminPage initial={initial} />;
}
