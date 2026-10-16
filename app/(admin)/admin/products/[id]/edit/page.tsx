import type { Metadata } from "next";
import { getServerLabels } from "@/features/settings/server/labels.server";
import { ProductFormPage } from "@/apps/admin/products/components/product-form-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { getProductById } from "@/features/products/data/products-service";
import { getCatalog } from "@/features/catalog/server/catalog.service";
import { readSeoForAdmin } from "@/features/site-layout/server/site-layout.initial";
import { getSettings } from "@/features/settings/server/settings.service";
import type { CommerceSettings } from "@/types/settings";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const { productWord } = await getServerLabels();
  return {
    title: `Edit ${productWord}`,
    description: `Edit existing ${productWord.toLowerCase()} details.`,
  };
}

/**
 * The product in the HTML, so the form is filled when it paints instead of
 * after the admin bundle has loaded and asked for it. A missing product falls
 * through to the form's own fetch, which reports "not found" as it always did.
 */
export default async function Page({ params }: PageProps) {
  const { id } = await params;
  // With the taxonomy the pickers offer and the SEO store the preview reads.
  const [initialProduct, initial] = await Promise.all([
    whenAdmin(() => getProductById(id)),
    whenAdmin(async () => {
      const [catalog, seo, settings] = await Promise.all([getCatalog(), readSeoForAdmin(), getSettings()]);
      // The delivery speeds and wording the form shows, so its HTML matches its first render.
      const commerce = (settings as { commerce?: CommerceSettings }).commerce;
      const delivery = {
        tiers: commerce?.deliveryTiers ?? [],
        information: commerce?.deliveryInformation ?? "",
      };
      return JSON.parse(JSON.stringify({ catalog, seo, delivery }));
    }),
  ]);
  return (
    <ProductFormPage
      mode="edit"
      cakeId={id}
      initialProduct={initialProduct}
      initialCatalog={initial?.catalog ?? null}
      initialSeo={initial?.seo ?? null}
      initialDelivery={initial?.delivery ?? null}
    />
  );
}
