import type { Metadata } from "next";
import { getServerLabels } from "@/features/settings/server/labels.server";
import { ProductFormPage } from "@/apps/admin/products/components/product-form-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { getCatalog } from "@/features/catalog/server/catalog.service";
import { readSeoForAdmin } from "@/features/site-layout/server/site-layout.initial";

export async function generateMetadata(): Promise<Metadata> {
  const { productWord } = await getServerLabels();
  return {
    title: `Add ${productWord}`,
    description: `Create a new ${productWord.toLowerCase()} with images, SEO, and categories.`,
  };
}

/** The taxonomy the pickers offer and the SEO store the preview reads, with the page. */
export default async function Page() {
  const initial = await whenAdmin(async () => {
    const [catalog, seo] = await Promise.all([getCatalog(), readSeoForAdmin()]);
    return JSON.parse(JSON.stringify({ catalog, seo }));
  });
  return (
    <ProductFormPage
      mode="add"
      initialCatalog={initial?.catalog ?? null}
      initialSeo={initial?.seo ?? null}
    />
  );
}
