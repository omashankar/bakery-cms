import type { LandingProduct, LandingCategory } from "@/constants/landing-data";
import { loadProducts } from "@/features/products/lib/products-repository";
import { getPublishedStorefrontProducts } from "@/features/products/lib/product-mapper";
import { getCategories } from "@/features/catalog/lib/catalog-repository";
import { filterProductsByCategory, getAllProducts } from "@/features/products/lib/product-catalog";

export type HomepageProductSource =
  | "featured"
  | "trending"
  | "best-sellers"
  | "photo-cakes"
  | "eggless"
  | "seasonal";

function getPublishedAdminProducts(): ReturnType<typeof loadProducts> {
  return loadProducts().filter((cake) => cake.status === "published");
}

function getAdminProductFlags() {
  const published = getPublishedAdminProducts();
  return {
    featured: published.filter((cake) => cake.isFeatured),
    trending: published.filter((cake) => cake.isTrending),
    bestSellers: published.filter((cake) => cake.isBestSeller),
    photo: published.filter((cake) => cake.isPhotoCake),
    eggless: published.filter((cake) => cake.isEggless),
    seasonal: published.filter((cake) => cake.isSeasonal),
  };
}

function mergeWithCatalog(adminCakes: LandingProduct[], fallback: LandingProduct[]): LandingProduct[] {
  if (adminCakes.length === 0) return fallback;
  const slugs = new Set(adminCakes.map((cake) => cake.slug));
  const extras = fallback.filter((cake) => !slugs.has(cake.slug));
  return [...adminCakes, ...extras];
}

export function getHomepageProducts(source: HomepageProductSource, maxCount = 8): LandingProduct[] {
  const flags = getAdminProductFlags();
  const all = getAllProducts();

  const adminMapped = getPublishedStorefrontProducts(loadProducts());
  const adminBySlug = new Map(adminMapped.map((cake) => [cake.slug, cake]));

  const pickAdmin = (cakes: ReturnType<typeof loadProducts>) =>
    cakes.map((cake) => adminBySlug.get(cake.slug)).filter((cake): cake is LandingProduct => Boolean(cake));

  const sourceMatchers: Record<HomepageProductSource, () => LandingProduct[]> = {
    featured: () => {
      const admin = pickAdmin(flags.featured);
      return mergeWithCatalog(admin, all.filter((cake) => cake.badge === "Featured"));
    },
    trending: () => {
      const admin = pickAdmin(flags.trending);
      return mergeWithCatalog(admin, all.filter((cake) => cake.badge === "Trending"));
    },
    "best-sellers": () => {
      const admin = pickAdmin(flags.bestSellers);
      return mergeWithCatalog(admin, all.filter((cake) => cake.badge === "Bestseller"));
    },
    "photo-cakes": () => {
      const admin = pickAdmin(flags.photo);
      return mergeWithCatalog(admin, filterProductsByCategory(all, "photo-cakes"));
    },
    eggless: () => {
      const admin = pickAdmin(flags.eggless);
      return mergeWithCatalog(admin, filterProductsByCategory(all, "eggless"));
    },
    seasonal: () => {
      const admin = pickAdmin(flags.seasonal);
      return mergeWithCatalog(admin, filterProductsByCategory(all, "seasonal"));
    },
  };

  const matched = sourceMatchers[source]();
  if (matched.length >= maxCount) return matched.slice(0, maxCount);

  // Keep grids full even when few cakes carry a given flag — relevant ones first,
  // then top up from the wider catalogue so a section never shows a lone card.
  const seen = new Set(matched.map((cake) => cake.slug));
  const extras = all.filter((cake) => !seen.has(cake.slug));

  // Rotate the top-up pool per source so adjacent sections don't repeat the same cakes.
  const sourceOrder: HomepageProductSource[] = [
    "featured",
    "trending",
    "best-sellers",
    "photo-cakes",
    "eggless",
    "seasonal",
  ];
  const offset = extras.length
    ? (Math.max(0, sourceOrder.indexOf(source)) * 4) % extras.length
    : 0;
  const rotated = [...extras.slice(offset), ...extras.slice(0, offset)];

  return [...matched, ...rotated].slice(0, maxCount);
}

export function getHomepageCategories(maxCount = 6): LandingCategory[] {
  const catalogCategories = getCategories();
  const publishedProducts = getPublishedAdminProducts();

  const mapped = catalogCategories.map((category) => {
    const count =
      category.cakeCount ??
      publishedProducts.filter((cake) => cake.categoryId === category.id).length;

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      image: category.image ?? "",
      count,
    } satisfies LandingCategory;
  });

  return mapped.filter((category) => category.image).slice(0, maxCount);
}
