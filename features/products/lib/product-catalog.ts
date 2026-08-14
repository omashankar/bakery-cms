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
import { slugify } from "@/utils/slug";
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
  categorySlug?: string,
  /** The shop's own categories, so a slug can be resolved to its name. */
  categories?: { name: string; slug: string }[],
): LandingProduct[] {
  if (!categorySlug) return cakes;
  const slug = slugify(categorySlug);

  /**
   * The shop's own taxonomy, resolved through the shop's own list.
   *
   * `cake.category` is the category's NAME — `product-mapper` resolves the id
   * to it — while the route carries its SLUG, and the two are edited
   * independently. This shop has "Birthday Cakes" at `/birthday`, "Eggless
   * Cakes" at `/eggless` and "Custom Cakes" at `/custom`, so neither comparing
   * them directly (`"birthday cakes".includes("birthday")` — false) nor
   * slugifying the name (`"birthday-cakes" !== "birthday"`) can work. Only the
   * category list knows which name goes with which slug.
   *
   * Passing it is optional so the homepage rails and the demo catalogue keep
   * working; without it this falls back to matching the slugified name, which
   * is right whenever a shop has not renamed a category away from its slug.
   */
  const named = categories?.find((category) => slugify(category.slug) === slug);
  const byCategory = (cake: LandingProduct) =>
    named
      ? cake.category.trim().toLowerCase() === named.name.trim().toLowerCase()
      : slugify(cake.category) === slug;

  /**
   * Occasion categories match the cake's OCCASION TAGS.
   *
   * These used to be guessed from flavour whitelists and name regexes — a
   * "birthday" page showed every chocolate, classic, premium, fruit and
   * international cake in the shop, whether or not the baker had tagged it for
   * birthdays, and "pastries" was a regex over the cake's name. `product-mapper`
   * already carries the real tags, and its own comment records why guessing was
   * wrong for exactly this: "a cake tagged Wedding was missed unless it happened
   * to say so in prose, and anything mentioning it in passing was included."
   */
  const byOccasion = (cake: LandingProduct) =>
    (cake.occasions ?? []).some((occasion) => slugify(occasion) === slug);

  /**
   * Two categories are properties of the cake rather than a taxonomy entry, and
   * the shop tags them on the product itself. Kept because they are real
   * fields, unlike the keyword guessing above.
   */
  const byAttribute = (cake: LandingProduct) => {
    if (slug === "photo-cakes" || slug === "photo") return cake.allowsPhotoUpload === true;
    if (slug === "eggless") return cake.isEggless === true;
    return false;
  };

  return cakes.filter(
    (cake) => byCategory(cake) || byOccasion(cake) || byAttribute(cake),
  );
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
