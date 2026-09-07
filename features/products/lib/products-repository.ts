import type { LandingProduct } from "@/constants/landing-data";
import {
  bestSellers,
  egglessCakes,
  featuredProducts,
  photoCakes,
  seasonalCakes,
  trendingProducts,
  weddingCakes,
} from "@/constants/landing-data";
import { fixBrokenImageUrl } from "@/constants/demo-images";
import type { Product, ProductFormData } from "@/types";
import {
  adminCategories,
  adminOccasions,
  getCategoryByName,
} from "./catalog-options";
import { slugify } from "./product-utils";
import { normalizeVariantGroups } from "./variant-utils";

const STORAGE_KEY = "bakery-cms-admin-cakes";
const STORAGE_VERSION_KEY = "bakery-cms-admin-cakes-version";
/** v6: variant options carry an explicit `semantic`, backfilled from legacy labels. */
const CAKES_STORAGE_VERSION = 6;

/**
 * Fired whenever the product cache changes — including when `useProductCacheSync`
 * replaces it with the server's copy on entering the admin. Screens that read
 * products synchronously (dashboard, inventory, global search) subscribe to this;
 * without it they keep rendering whatever this browser happened to have cached
 * when they mounted, which on a fresh browser is the seeded demo catalogue.
 */
export const PRODUCTS_UPDATED_EVENT = "bakery-products-updated";

function emitProductsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PRODUCTS_UPDATED_EVENT));
}

/**
 * Write without notifying. Used by `loadProducts` for its own seed/normalise
 * self-heal: that runs *inside* readers, so emitting there would re-enter every
 * subscriber from within its own render.
 */
function writeProducts(cakes: Product[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cakes));
}

function nowIso(): string {
  return new Date().toISOString();
}

function mapLandingProductToAdmin(cake: LandingProduct, index: number): Product {
  const timestamp = nowIso();
  const category =
    getCategoryByName(cake.category) ??
    getCategoryByName(cake.category.split(" ")[0] ?? "") ?? {
      id: `cat-${slugify(cake.category)}`,
      name: cake.category,
      slug: slugify(cake.category),
      createdAt: timestamp,
      updatedAt: timestamp,
    };


  const occasionIds =
    cake.category.toLowerCase().includes("wedding") ||
    cake.slug.includes("wedding")
      ? [adminOccasions().find((o) => o.slug === "wedding")?.id ?? ""].filter(Boolean)
      : [adminOccasions().find((o) => o.slug === "birthday")?.id ?? ""].filter(Boolean);

  return {
    id: cake.id,
    name: cake.name,
    slug: cake.slug,
    description: cake.description,
    shortDescription: cake.description.slice(0, 100),
    price: cake.price,
    // NO INVENTED MRP. This was `price > 1000 ? price * 1.1 : undefined`, so
    // every demo product over Rs 1000 wore a permanent “9% OFF” against a
    // price nobody had ever charged. A struck-through number is a claim about
    // the past, and the shop is the only one who can make it.
    compareAtPrice: cake.compareAtPrice,
    images: [cake.image],
    categoryId: category.id,
    occasionIds,
    /**
     * The demo cakes' own sizes, named here rather than derived.
     *
     * This called `getDefaultWeights(cake.price)` — the shop-wide Catalog list
     * — which is gone: sizes are typed on the product. The three tiers are the
     * ones that list used to hold, so a fresh demo install looks exactly as it
     * did, and an owner can now change them per cake without touching anything
     * else in the shop.
     */
    weights: [
      { label: "0.5 kg", price: cake.price, serves: "4–6" },
      { label: "1 kg", price: cake.price + 200, serves: "8–10" },
      { label: "1.5 kg", price: cake.price + 450, serves: "12–15" },
    ],
    status: index === 1 ? "draft" : "published",
    isFeatured: cake.badge === "Featured",
    isBestSeller: cake.badge === "Bestseller",
    isTrending: cake.badge === "Trending",
    // Nothing in the landing data says a product comes in Round, Square and
    // Heart — the seed said it on their behalf, and the storefront then offered
    // the picker. The last copy of the injection 46b04b2 removed.
    shapes: [],
    flavourOptions: cake.flavours ?? [],
    stockStatus: cake.inStock === false ? "out_of_stock" : index % 5 === 0 ? "low_stock" : "in_stock",
    stockQuantity: cake.inStock === false ? 0 : index % 5 === 0 ? 6 : 50,
    unlimitedStock: false,
    lowStockThreshold: undefined,
    allowsMessage: true,
    allowsPhotoUpload: cake.category.toLowerCase().includes("photo"),
    /*
      A seed used to stamp shelfLifeDays 3, calories 320 and a care sentence
      onto every demo product, and preparationTimeMinutes was derived from the
      category. All four fields have gone from the product; careInstructions is
      the one that remains, and it stays blank because a care note is the
      shop own to write.
    */
    /*
      A "Photo cake" group used to be built here for any demo product filed
      under a category with the word in it — a paid print option beside a free
      one. A product that takes a photograph takes one, and the price of
      printing is part of its price, so there is no group to build.
    */
    variantGroups: [],
    // Zero, not 4.5. A shop opened advertising “4.5 ★ · 12 reviews” on every
    // product with no review behind any of it — and the honest aggregate then
    // averaged its first real review against a number that was never earned.
    // ZERO, not what the demo data says. The landing fixtures carry their own
    // 4.9s and 4.7s — fine as marketing copy on the vendor’s own page, and a
    // lie the moment they are seeded into a real shop’s catalogue as that
    // shop’s ratings. `?? 0` was not enough: the fixtures do set them.
    rating: 0,
    reviewCount: 0,
    seo: {
      // Name only. The shop's brand comes from SEO → Title Suffix, which is
      // applied once at render; baking it in here printed it twice.
      metaTitle: cake.name,
      metaDescription: cake.description,
      ogImage: cake.image,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function getSeedLandingProducts(): LandingProduct[] {
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

export function seedProducts(): Product[] {
  return getSeedLandingProducts().map(mapLandingProductToAdmin);
}

export function normalizeCommerceFields(cake: Product): Product {
  const variantGroups = normalizeVariantGroups(cake);

  return {
    ...cake,
    // Never Round/Square/Heart by default. This runs on every repository read,
    // so a phone charger came back from the database with three cake shapes on
    // it — offered to the customer, and stamped onto the order line they chose
    // from. A product with no shapes is sold in one shape, which is most of them.
    shapes: cake.shapes ?? [],
    flavourOptions: cake.flavourOptions ?? [],
    stockStatus: cake.stockStatus ?? "in_stock",
    stockQuantity: cake.stockQuantity ?? 50,
    unlimitedStock: cake.unlimitedStock ?? false,
    lowStockThreshold: cake.lowStockThreshold,
    allowsMessage: cake.allowsMessage ?? true,
    allowsPhotoUpload: cake.allowsPhotoUpload ?? false,

    variantGroups,
    // Owner-defined facts. Absent means the shop has stated none, not that it
    // needs some invented for it — the mistake this function made with shapes.
    descriptionBlocks: cake.descriptionBlocks ?? [],
    /**
     * A product nobody has reviewed has no stars.
     *
     * `createEmptyProductForm` was fixed to write 0 — "a cake with no reviews
     * has no rating. This started at 4.5" — and this, three lines below the
     * shape injection removed in the same pass, kept inventing 4.5 stars from
     * 12 reviews for any document that simply omits the fields. It runs on
     * EVERY repository read, so an imported product, a legacy row or a restored
     * backup came back advertising social proof that no review anywhere
     * supports, rendered as stars on every grid card and at the top of the
     * product page. `rating` and `reviewCount` are owned by the reviews
     * aggregate, which writes them directly; absent means nobody has said
     * anything yet, and that is what it should read as.
     */
    rating: cake.rating ?? 0,
    reviewCount: cake.reviewCount ?? 0,
  };
}

function normalizeProductImages(cakes: Product[]): { cakes: Product[]; changed: boolean } {
  let changed = false;

  const next = cakes.map((cake) => {
    const commerce = normalizeCommerceFields(cake);
    const images = (commerce.images ?? []).map((url) => fixBrokenImageUrl(url));
    const ogImage = commerce.seo?.ogImage
      ? fixBrokenImageUrl(commerce.seo.ogImage)
      : commerce.seo?.ogImage;

    const imagesChanged = images.some((url, index) => url !== commerce.images[index]);
    const ogChanged = (ogImage ?? "") !== (commerce.seo?.ogImage ?? "");
    const commerceChanged = commerce !== cake;

    if (!imagesChanged && !ogChanged && !commerceChanged) return cake;

    changed = true;
    return {
      ...commerce,
      images,
      seo: {
        ...commerce.seo,
        ogImage,
      },
    };
  });

  return { cakes: next, changed };
}

/**
 * Every size label this shop has already typed, commonest first.
 *
 * NOT a taxonomy. There is no list to maintain, nothing to keep in step with
 * the products, and nothing that can go stale: this is a reading of what the
 * shop has actually done, offered back as suggestions while it types the next
 * one. Delete every product that uses a label and the label stops being
 * offered, because it is no longer true that the shop sells it.
 *
 * A shop-wide list of sizes is what this replaces, and the reason it had to go
 * is that it forced one product's sizes onto every other — a cake shop that
 * also sells chargers had “0.5 kg” offered for a charger and nothing for the
 * cable length. The reason this exists at all is the other half of that same
 * problem: a shop with thirty products should not type “500 gm” thirty times,
 * and two spellings of one size split the storefront filter in two.
 */
export function sizeLabelsInUse(): string[] {
  const seen = new Map<string, number>();

  for (const product of loadProducts()) {
    for (const tier of product.weights ?? []) {
      const label = tier.label?.trim();
      if (!label) continue;
      seen.set(label, (seen.get(label) ?? 0) + 1);
    }
  }

  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label);
}

/**
 * What one of those sizes usually costs on this shop's other products.
 *
 * Offered as the starting price when a size is added by name, so adding
 * “1 kg” to the thirty-first product does not mean looking up what the other
 * thirty charge. The MEDIAN rather than the mean: one mispriced product
 * should not drag the suggestion, and a shop with two price points gets one
 * of the two rather than a number nobody charges.
 */
export function usualPriceForSize(label: string): number | null {
  const wanted = label.trim().toLowerCase();
  if (!wanted) return null;

  const prices = loadProducts()
    .flatMap((product) => product.weights ?? [])
    .filter((tier) => tier.label?.trim().toLowerCase() === wanted)
    .map((tier) => tier.price)
    .filter((price) => typeof price === "number" && price > 0)
    .sort((a, b) => a - b);

  if (prices.length === 0) return null;
  return prices[Math.floor(prices.length / 2)];
}

export function loadProducts(): Product[] {
  if (typeof window === "undefined") return seedProducts();

  try {
    // Inside the try. `localStorage.getItem` itself throws in a browser that
    // denies storage — private mode, or blocked third-party cookies — and this
    // read sat outside it, so every admin screen that calls this crashed rather
    // than falling back to the server.
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedProducts();
      writeProducts(seeded);
      localStorage.setItem(STORAGE_VERSION_KEY, String(CAKES_STORAGE_VERSION));
      return seeded;
    }

    const parsed = JSON.parse(raw) as Product[];
    // Only corrupt data re-seeds. A stored empty array is a real answer — it is
    // what `useProductCacheSync` writes when the server's catalogue is empty —
    // and re-seeding it would resurrect the demo cakes on top of a live backend.
    if (!Array.isArray(parsed)) {
      const seeded = seedProducts();
      writeProducts(seeded);
      localStorage.setItem(STORAGE_VERSION_KEY, String(CAKES_STORAGE_VERSION));
      return seeded;
    }

    const storedVersion = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 1);
    const { cakes: normalized, changed } = normalizeProductImages(parsed);

    if (changed || storedVersion < CAKES_STORAGE_VERSION) {
      writeProducts(normalized);
      localStorage.setItem(STORAGE_VERSION_KEY, String(CAKES_STORAGE_VERSION));
    }

    return normalized;
  } catch {
    // Do NOT re-seed here.
    //
    // This catch covers a failed localStorage WRITE as well as a parse failure —
    // a full quota, or private browsing — and it answered both by replacing the
    // shop's cached catalogue with 34 demo cakes. The screens that read this
    // cache then showed demo products to an admin whose real ones were fine on
    // the server, and a save from one of those screens could publish them.
    //
    // Empty is the honest answer: `useProductCacheSync` refills it from the
    // server on the next pass.
    return [];
  }
}

export function persistProducts(cakes: Product[]): void {
  writeProducts(cakes);
  emitProductsUpdated();
}

export function getProductById(id: string): Product | null {
  return loadProducts().find((cake) => cake.id === id) ?? null;
}

export function getProductBySlug(slug: string): Product | null {
  return loadProducts().find((cake) => cake.slug === slug) ?? null;
}

export function createProduct(data: ProductFormData): Product {
  const cakes = loadProducts();
  const timestamp = nowIso();
  const cake: Product = {
    ...data,
    id: `cake-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  persistProducts([cake, ...cakes]);
  return cake;
}

export function updateProduct(id: string, data: ProductFormData): Product | null {
  const cakes = loadProducts();
  const index = cakes.findIndex((cake) => cake.id === id);
  if (index === -1) return null;

  const updated: Product = {
    ...cakes[index],
    ...data,
    id,
    updatedAt: nowIso(),
  };
  cakes[index] = updated;
  persistProducts(cakes);
  return updated;
}

export function deleteProduct(id: string): boolean {
  const cakes = loadProducts();
  const next = cakes.filter((cake) => cake.id !== id);
  if (next.length === cakes.length) return false;
  persistProducts(next);
  return true;
}

export function bulkUpdateStatus(ids: string[], status: Product["status"]): number {
  const cakes = loadProducts();
  let count = 0;
  const updated = cakes.map((cake) => {
    if (!ids.includes(cake.id)) return cake;
    count += 1;
    return { ...cake, status, updatedAt: nowIso() };
  });
  persistProducts(updated);
  return count;
}

export function bulkDeleteProducts(ids: string[]): number {
  const cakes = loadProducts();
  const next = cakes.filter((cake) => !ids.includes(cake.id));
  const count = cakes.length - next.length;
  persistProducts(next);
  return count;
}

export function createEmptyProductForm(): ProductFormData {
  return {
    name: "",
    slug: "",
    description: "",
    shortDescription: "",
    price: 999,
    compareAtPrice: undefined,
    images: [],
    categoryId: adminCategories()[0]?.id ?? "1",
    occasionIds: [],
    /**
     * A NEW PRODUCT IS BORN EMPTY.
     *
     * These four fields used to arrive pre-filled with cake: three weight tiers
     * from the Catalog presets, Round/Square/Heart, an "Egg preference" group
     * charging +80 for Eggless, and a 120-minute prep time. A shop adding a
     * phone charger had to find and delete every one of them, on every product,
     * and the CMS read as though it were telling them what kind of shop to run.
     *
     * Nothing is lost for the bakery, but say where it actually is: the Pricing
     * tab has "Sell this by size", which fills the Catalog weight presets, and
     * the Options tab has "Add egg / eggless" and "Add option". An earlier
     * version of this note named "Reset to defaults", which has since been
     * deleted — it replaced the whole array rather than adding to it, so one
     * click on a charger wiped Storage and Colour. A merchant asking for cake
     * options gets them; a merchant who never asked no longer has to undo them.
     */
    weights: [],
    status: "draft",
    isFeatured: false,
    isBestSeller: false,
    isTrending: false,
    shapes: [],
    flavourOptions: [],
    stockStatus: "in_stock",
    stockQuantity: 50,
    unlimitedStock: false,
    lowStockThreshold: undefined,
    allowsMessage: true,
    allowsPhotoUpload: false,

    variantGroups: [],
    descriptionBlocks: [],
    // A cake with no reviews has no rating. This started at 4.5.
    rating: 0,
    reviewCount: 0,
    seo: {
      metaTitle: "",
      metaDescription: "",
    },
  };
}
