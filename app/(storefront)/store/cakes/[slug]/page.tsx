import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailPage } from "@/apps/website";
import type { LandingProduct } from "@/constants/landing-data";
import {
  getProductBySlug,
  getStorefrontProductBySlug,
  getStorefrontProductCards,
} from "@/features/products/data/products-service";
import { getSiteIdentity } from "@/features/settings/server/site-identity.server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Per-cake metadata, from what the admin typed on the product's SEO tab.
 *
 * This was a static `metadata` export, which cannot depend on the route params —
 * so every cake in the shop shipped the identical head: "Cake Details | <shop>"
 * and "Product details, pricing, and order inquiry." A shop writing a bespoke
 * meta title for two hundred cakes got two hundred pages Google cannot tell
 * apart, and the SEO tab's own preview card showed the typed title as though it
 * were live. Nothing in app/ read `seo.metaTitle` at all.
 *
 * Every other storefront route already uses `generateMetadata`; this one did not.
 */
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  // The full product, not the storefront projection — `seo` and
  // `shortDescription` are admin-side fields the projection does not carry.
  const cake = await getProductBySlug(slug);

  if (!cake || cake.status !== "published") return { title: "Cake not found" };

  // Falling back to the product's own name and description keeps a shop that has
  // never opened the SEO tab from publishing one shared title anyway.
  const description =
    cake.seo?.metaDescription?.trim() ||
    cake.shortDescription?.trim() ||
    cake.description?.trim() ||
    "Product details, pricing, and order inquiry.";

  const typed = cake.seo?.metaTitle?.trim();
  const { siteName } = await getSiteIdentity();

  // The root layout appends "| <shop>" to every title. An admin who writes the
  // shop's name into the meta title themselves — and every product here already
  // carries one, because the form used to append a hard-coded "| Monginis" —
  // would otherwise get it twice: "Black Forest Supreme | Monginis | Monginis".
  // Taking the typed title as absolute respects what was written either way.
  const alreadyBranded =
    !!typed && !!siteName && typed.toLowerCase().endsWith(siteName.trim().toLowerCase());

  return {
    title: alreadyBranded ? { absolute: typed } : typed || cake.name,
    // Search results truncate around here, and the admin field allows more.
    description: description.slice(0, 160),
    alternates: cake.slug ? { canonical: `/store/cakes/${cake.slug}` } : undefined,
  };
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
