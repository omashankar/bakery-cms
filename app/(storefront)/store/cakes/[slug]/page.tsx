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
import { buildCanonicalUrl } from "@/features/seo/lib/seo-metadata";
import { getSeoStoreServer } from "@/features/seo/server/seo-store.server";

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
  const [{ siteName }, { global }] = await Promise.all([getSiteIdentity(), getSeoStoreServer()]);

  // The root layout appends "| <shop>" to every title. An admin who writes the
  // shop's name into the meta title themselves — and every product here already
  // carries one, because the form used to append a hard-coded brand suffix —
  // would otherwise get it twice: "Black Forest Supreme | Acme | Acme".
  // Taking the typed title as absolute respects what was written either way.
  const alreadyBranded =
    !!typed && !!siteName && typed.toLowerCase().endsWith(siteName.trim().toLowerCase());

  const path = cake.slug ? `/store/cakes/${cake.slug}` : "";
  /**
   * ABSOLUTE, like every other route on this site.
   *
   * This shipped `canonical: "/store/cakes/<slug>"` — a bare path — while every
   * static route goes through `buildCanonicalUrl` and carries the shop's
   * domain. There is no `metadataBase` to fill the gap, so it reached the
   * browser relative, and the one job a canonical has is to say WHICH host owns
   * this page: a relative one cannot tell www from apex, or staging from live.
   * These are the pages a bakery is actually found for.
   */
  const canonical = path ? buildCanonicalUrl(path, global) : undefined;
  const image = cake.images?.[0]?.trim() || global.defaultOgImage?.trim();
  const title = alreadyBranded ? typed : typed || cake.name;

  return {
    title: alreadyBranded ? { absolute: typed } : typed || cake.name,
    // Search results truncate around here, and the admin field allows more.
    description: description.slice(0, 160),
    alternates: canonical ? { canonical } : undefined,
    /**
     * And a share card, which product pages had none of.
     *
     * Every static route emits Open Graph tags; these did not, so a cake shared
     * to WhatsApp or Facebook — the way a bakery is passed around — arrived as
     * a bare link with no picture, no name and no price context. The product's
     * own photo is the right image; the shop's default is the fallback.
     */
    openGraph: {
      title,
      description: description.slice(0, 160),
      url: canonical,
      siteName: global.siteName,
      images: image ? [{ url: image }] : undefined,
      type: "website",
    },
    twitter: {
      card: global.defaultTwitterCard ?? "summary_large_image",
      title,
      description: description.slice(0, 160),
      images: image ? [image] : undefined,
    },
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
