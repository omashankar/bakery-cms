import {
  bestSellers,
  egglessCakes,
  featuredCakes,
  photoCakes,
  seasonalCakes,
  trendingCakes,
  weddingCakes,
  type LandingCake,
} from "@/constants/landing-data";
import { loadCakes } from "@/features/admin/cakes/lib/cakes-repository";
import { getPublishedStorefrontCakes } from "@/features/admin/cakes/lib/cake-mapper";
import { getWeightOptions } from "@/features/admin/catalog/lib/catalog-repository";

function getLandingCatalog(): LandingCake[] {
  const combined = [
    ...featuredCakes,
    ...trendingCakes,
    ...bestSellers,
    ...weddingCakes,
    ...photoCakes,
    ...egglessCakes,
    ...seasonalCakes,
  ];
  const seen = new Set<string>();
  return combined.filter((cake) => {
    if (seen.has(cake.slug)) return false;
    seen.add(cake.slug);
    return true;
  });
}

function mergeStorefrontCakes(): LandingCake[] {
  const landing = getLandingCatalog();
  const adminPublished = getPublishedStorefrontCakes(loadCakes());
  const adminBySlug = new Map(adminPublished.map((cake) => [cake.slug, cake]));

  const merged = landing.map((cake) => adminBySlug.get(cake.slug) ?? cake);

  for (const cake of adminPublished) {
    if (!landing.some((item) => item.slug === cake.slug)) {
      merged.push(cake);
    }
  }

  return merged;
}

/** All unique cakes — admin published overrides landing mock data */
export function getAllCakes(): LandingCake[] {
  return mergeStorefrontCakes();
}

export function getCakeBySlug(slug: string): LandingCake | undefined {
  return getAllCakes().find((cake) => cake.slug === slug);
}

export function searchCakes(query: string): LandingCake[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return getAllCakes();

  return getAllCakes().filter(
    (cake) =>
      cake.name.toLowerCase().includes(normalized) ||
      cake.description.toLowerCase().includes(normalized) ||
      cake.category.toLowerCase().includes(normalized)
  );
}

export function filterCakesByCategory(
  cakes: LandingCake[],
  categorySlug?: string
): LandingCake[] {
  if (!categorySlug) return cakes;
  const slug = categorySlug.toLowerCase();

  const slugMatchers: Record<string, (cake: LandingCake) => boolean> = {
    "photo-cakes": (cake) =>
      cake.category.toLowerCase().includes("photo") ||
      cake.allowsPhotoUpload === true,
    eggless: (cake) =>
      cake.isEggless === true || cake.category.toLowerCase().includes("eggless"),
    seasonal: (cake) => cake.category.toLowerCase().includes("seasonal"),
    birthday: (cake) =>
      cake.category.toLowerCase().includes("birthday") ||
      cake.slug.includes("birthday"),
    wedding: (cake) => cake.category.toLowerCase().includes("wedding"),
    anniversary: (cake) => cake.category.toLowerCase().includes("anniversary"),
    pastries: (cake) => cake.category.toLowerCase().includes("pastry"),
    cupcakes: (cake) => cake.category.toLowerCase().includes("cupcake"),
    custom: (cake) => cake.category.toLowerCase().includes("custom"),
  };

  const matcher = slugMatchers[slug];
  if (matcher) return cakes.filter(matcher);

  return cakes.filter(
    (cake) =>
      cake.category.toLowerCase().includes(slug) ||
      cake.slug.includes(slug)
  );
}

/** Weight options from catalog admin (falls back to defaults on server) */
export function getCakeWeightOptions(cake?: LandingCake) {
  if (cake?.weights?.length) {
    return cake.weights.map((weight) => ({
      label: weight.label,
      modifier: Math.max(0, weight.price - cake.price),
      serves: weight.serves,
    }));
  }

  return getWeightOptions().map((option) => ({
    label: option.label,
    modifier: option.modifier,
    serves: option.serves,
  }));
}

/** @deprecated Use getCakeWeightOptions() */
export const cakeWeightOptions = [
  { label: "0.5 kg", modifier: 0, serves: "4–6" },
  { label: "1 kg", modifier: 200, serves: "8–10" },
  { label: "1.5 kg", modifier: 450, serves: "12–15" },
] as const;
