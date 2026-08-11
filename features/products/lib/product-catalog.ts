import {
  bestSellers,
  egglessCakes,
  featuredProducts,
  photoCakes,
  seasonalCakes,
  trendingProducts,
  weddingCakes,
  type LandingProduct,
} from "@/constants/landing-data";
import { loadProducts } from "@/features/products/lib/products-repository";
import { getPublishedStorefrontProducts } from "@/features/products/lib/product-mapper";
import { getWeightOptions } from "@/features/catalog/lib/catalog-repository";
import { defaultWeightOptions } from "@/features/catalog/lib/catalog-utils";

function getLandingCatalog(): LandingProduct[] {
  const combined = [
    ...featuredProducts,
    ...trendingProducts,
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

function mergeStorefrontProducts(): LandingProduct[] {
  const landing = getLandingCatalog();
  const adminPublished = getPublishedStorefrontProducts(loadProducts());
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
export function getAllProducts(): LandingProduct[] {
  return mergeStorefrontProducts();
}

export function getProductBySlug(slug: string): LandingProduct | undefined {
  return getAllProducts().find((cake) => cake.slug === slug);
}

/**
 * Everything a search term is allowed to match on one cake.
 *
 * Search used to be name, category and DESCRIPTION — and the storefront's
 * search page runs on the card projection, where `toCard` deliberately sets
 * `description: ""` to keep the payload small. So a third of the predicate
 * matched nothing on the one surface that uses it, and a customer searching
 * for a word that appears only in a cake's description was told there were no
 * results.
 *
 * The flavours and occasions were already in that payload — carried for the
 * filter panel — and are what customers actually type ("chocolate",
 * "wedding"). The description stays in the haystack for callers that pass full
 * products, where it is real.
 */
function searchHaystack(cake: LandingProduct): string {
  return [
    cake.name,
    cake.category,
    cake.description,
    ...(cake.flavours ?? []),
    ...(cake.occasions ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function searchProducts(query: string, catalog?: LandingProduct[]): LandingProduct[] {
  const source = catalog ?? getAllProducts();
  const normalized = query.trim().toLowerCase();
  if (!normalized) return source;

  return source.filter((cake) => searchHaystack(cake).includes(normalized));
}

export function filterProductsByCategory(
  cakes: LandingProduct[],
  categorySlug?: string
): LandingProduct[] {
  if (!categorySlug) return cakes;
  const slug = categorySlug.toLowerCase();

  const cat = (cake: LandingProduct) => cake.category.toLowerCase();
  const text = (cake: LandingProduct) => `${cake.name} ${cake.slug}`.toLowerCase();
  // Occasion categories aren't stored on cakes directly (cakes are tagged by
  // flavour), so map each occasion to the relevant flavour sets / keywords.
  const CELEBRATION = ["chocolate", "classic", "premium", "fruit", "international"];

  const slugMatchers: Record<string, (cake: LandingProduct) => boolean> = {
    "photo-cakes": (cake) => cat(cake).includes("photo") || cake.allowsPhotoUpload === true,
    eggless: (cake) => cake.isEggless === true || cat(cake).includes("eggless"),
    seasonal: (cake) => cat(cake).includes("seasonal"),
    wedding: (cake) => cat(cake).includes("wedding"),
    birthday: (cake) => CELEBRATION.includes(cat(cake)) || /birthday/.test(text(cake)),
    anniversary: (cake) =>
      ["premium", "classic", "international", "fruit"].includes(cat(cake)) ||
      /anniversary/.test(text(cake)),
    pastries: (cake) =>
      /pastry|brownie|tiramisu|mousse|gateau|gâteau/.test(text(cake)) ||
      cat(cake) === "international",
    cupcakes: (cake) => /cupcake|muffin|brownie/.test(text(cake)),
    custom: (cake) =>
      cake.allowsPhotoUpload === true ||
      cake.allowsMessage === true ||
      cat(cake).includes("photo") ||
      cat(cake).includes("custom"),
  };

  const matcher = slugMatchers[slug];
  if (matcher) return cakes.filter(matcher);

  return cakes.filter((cake) => cat(cake).includes(slug) || cake.slug.includes(slug));
}

/** Weight options from catalog admin (falls back to defaults on server) */
export function getProductWeightOptions(cake?: LandingProduct) {
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

/**
 * Default (localStorage-free) weight options — identical to what the server
 * renders from the seed catalog. Used for the product page's first paint so a
 * product without its own weights hydrates without a mismatch; the client swaps
 * in the live catalog values after mount.
 */
export function getDefaultProductWeightOptions() {
  return [...defaultWeightOptions]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((option) => ({
      label: option.label,
      modifier: option.modifier,
      serves: option.serves,
    }));
}

/** @deprecated Use getProductWeightOptions() */
export const productWeightOptions = [
  { label: "0.5 kg", modifier: 0, serves: "4–6" },
  { label: "1 kg", modifier: 200, serves: "8–10" },
  { label: "1.5 kg", modifier: 450, serves: "12–15" },
] as const;
