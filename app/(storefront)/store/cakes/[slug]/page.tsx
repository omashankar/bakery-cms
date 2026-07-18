import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailPage } from "@/features/storefront";
import type { LandingProduct } from "@/constants/landing-data";
import {
  getStorefrontProductBySlug,
  getStorefrontProductCards,
} from "@/features/products/data/products-service";

export const metadata: Metadata = {
  title: "Cake Details",
  description: "Product details, pricing, and order inquiry.",
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Same-category first, then top up so the rail always shows a full set of 4. */
function pickRelated(
  catalog: LandingProduct[],
  slug: string,
  category: string
): LandingProduct[] {
  const all = catalog.filter((item) => item.slug !== slug);
  const sameCategory = all.filter((item) => item.category === category);
  const seen = new Set(sameCategory.map((item) => item.slug));
  const others = all.filter((item) => !seen.has(item.slug));
  return [...sameCategory, ...others].slice(0, 4);
}

export default async function Page(props: PageProps) {
  const { slug } = await props.params;

  // Fetched on the server, so the first paint already carries real catalogue
  // data — previously this ran against localStorage, which the server does not
  // have, so SSR rendered seed data and the client swapped it on hydration.
  const [cake, catalog] = await Promise.all([
    getStorefrontProductBySlug(slug),
    getStorefrontProductCards(),
  ]);

  if (!cake) {
    notFound();
  }

  return (
    <ProductDetailPage
      cake={cake}
      related={pickRelated(catalog, cake.slug, cake.category)}
      catalog={catalog}
    />
  );
}
