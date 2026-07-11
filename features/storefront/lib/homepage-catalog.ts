import type { LandingCake, LandingCategory } from "@/constants/landing-data";
import { loadCakes } from "@/features/admin/cakes/lib/cakes-repository";
import { getPublishedStorefrontCakes } from "@/features/admin/cakes/lib/cake-mapper";
import { getCategories } from "@/features/admin/catalog/lib/catalog-repository";
import { filterCakesByCategory, getAllCakes } from "./catalog";

export type HomepageCakeSource =
  | "featured"
  | "trending"
  | "best-sellers"
  | "photo-cakes"
  | "eggless"
  | "seasonal";

function getPublishedAdminCakes(): ReturnType<typeof loadCakes> {
  return loadCakes().filter((cake) => cake.status === "published");
}

function getAdminCakeFlags() {
  const published = getPublishedAdminCakes();
  return {
    featured: published.filter((cake) => cake.isFeatured),
    trending: published.filter((cake) => cake.isTrending),
    bestSellers: published.filter((cake) => cake.isBestSeller),
    photo: published.filter((cake) => cake.isPhotoCake),
    eggless: published.filter((cake) => cake.isEggless),
    seasonal: published.filter((cake) => cake.isSeasonal),
  };
}

function mergeWithCatalog(adminCakes: LandingCake[], fallback: LandingCake[]): LandingCake[] {
  if (adminCakes.length === 0) return fallback;
  const slugs = new Set(adminCakes.map((cake) => cake.slug));
  const extras = fallback.filter((cake) => !slugs.has(cake.slug));
  return [...adminCakes, ...extras];
}

export function getHomepageCakes(source: HomepageCakeSource, maxCount = 8): LandingCake[] {
  const flags = getAdminCakeFlags();
  const all = getAllCakes();

  const adminMapped = getPublishedStorefrontCakes(loadCakes());
  const adminBySlug = new Map(adminMapped.map((cake) => [cake.slug, cake]));

  const pickAdmin = (cakes: ReturnType<typeof loadCakes>) =>
    cakes.map((cake) => adminBySlug.get(cake.slug)).filter((cake): cake is LandingCake => Boolean(cake));

  const sourceMatchers: Record<HomepageCakeSource, () => LandingCake[]> = {
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
      return mergeWithCatalog(admin, filterCakesByCategory(all, "photo-cakes"));
    },
    eggless: () => {
      const admin = pickAdmin(flags.eggless);
      return mergeWithCatalog(admin, filterCakesByCategory(all, "eggless"));
    },
    seasonal: () => {
      const admin = pickAdmin(flags.seasonal);
      return mergeWithCatalog(admin, filterCakesByCategory(all, "seasonal"));
    },
  };

  return sourceMatchers[source]().slice(0, maxCount);
}

export function getHomepageCategories(maxCount = 6): LandingCategory[] {
  const catalogCategories = getCategories();
  const publishedCakes = getPublishedAdminCakes();

  const mapped = catalogCategories.map((category) => {
    const count =
      category.cakeCount ??
      publishedCakes.filter((cake) => cake.categoryId === category.id).length;

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
