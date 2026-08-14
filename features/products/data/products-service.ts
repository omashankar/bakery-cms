import {
  mapAdminProductToStorefront,
  type TaxonomyNames,
} from "@/features/products/lib/product-mapper";
import { getCatalog } from "@/features/catalog/server/catalog.service";
import { readProducts } from "@/features/products/data/products-store.server";
import * as productRepo from "@/features/products/server/product.repository";
import { purgeProductTraces } from "@/features/products/server/product-cascade.server";
import type { LandingProduct } from "@/constants/landing-data";
import type { Product, ProductFormData } from "@/types/product";
import { defaultProductUnitPrice } from "@/features/products/lib/product-pricing";
import { variantGroupsEnabledBy } from "@/features/products/lib/variant-utils";
import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import { getSettings } from "@/features/settings/server/settings.service";
import type { ModuleSettings } from "@/types/settings";
import {
  buildHomepageProducts,
  type HomepageProductSource,
} from "@/features/products/lib/homepage-rails";

/**
 * Async product data access — the API the rest of the app should use on the server.
 *
 * Every function returns a Promise, so the eventual database swap is confined to
 * products-store.server.ts. Callers already await; they will not change.
 */

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * The shop's own category names, from the database.
 *
 * Without this the mapper falls back to `getCategoryById`, which reads a
 * localStorage-backed store — on the server that is `defaultCatalogStore`, the
 * DEMO taxonomy. Every server-rendered product page resolved its category
 * against the shipped list, so a renamed category never reached a customer and
 * a shop-added one rendered as the generic "Cakes".
 */
async function categoryNames(): Promise<TaxonomyNames> {
  try {
    const catalog = await getCatalog();
    const byId = (rows: unknown) =>
      new Map((rows as Array<{ id: string; name: string }>).map((r) => [r.id, r.name]));
    return { categories: byId(catalog.categories), occasions: byId(catalog.occasions) };
  } catch {
    // A catalog read that fails must not take the product page down with it.
    return {};
  }
}

export async function getProducts(): Promise<Product[]> {
  return readProducts();
}

export async function getProductById(id: string): Promise<Product | null> {
  const products = await readProducts();
  return products.find((product) => product.id === id) ?? null;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const products = await readProducts();
  return products.find((product) => product.slug === slug) ?? null;
}

/** Published products in the shape the storefront renders. */
export async function getStorefrontProducts(): Promise<LandingProduct[]> {
  const [products, names] = await Promise.all([readProducts(), categoryNames()]);
  return products
    .filter((product) => product.status === "published")
    .map((product) => mapAdminProductToStorefront(product, names));
}

/**
 * Card-shaped projection: what a card RENDERS, plus what the filter panel FILTERS ON.
 *
 * Rails are handed to a Client Component, so every field crosses the wire in the
 * RSC payload. Sending whole products would ship descriptions, variant groups
 * and full weight tables that no card displays — fine at 25 products, ruinous at
 * 5,000.
 *
 * But the collections page filters this projection on the client, and the fields
 * its filters read were not in it. So the occasion filter fell back to searching
 * the prose, the flavour filter did too, "Eggless only" fell back to matching
 * the category NAME, and the weight filter — which now matches real tiers —
 * matched everything, because no card carried any tiers to match against.
 *
 * The four fields below are what those filters need, kept as small as they can
 * be: occasion names are short strings, and the weight tiers are reduced to
 * their labels, since the filter compares labels and the card shows no prices
 * per tier.
 */
function toCard(product: LandingProduct, modules: ModuleSettings): LandingProduct {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    image: product.image,
    category: product.category,
    /**
     * The price the SHOP would charge for this cake untouched — not the base
     * price on the record.
     *
     * With nothing selected the server still applies each variant group's
     * default option, and those defaults are not always free: this shop's four
     * eggless cakes default to an "Eggless" option that adds ₹80. Cards showed
     * ₹1,099, the shop charged ₹1,179, and a customer who added one from a grid
     * met "Prices have changed" at the last step of checkout.
     *
     * Resolved here rather than on the client because `variantGroups` is not in
     * this payload and does not need to be — one number is smaller than the
     * groups it was computed from. Pricing itself is untouched: `priceCart`
     * reads full products straight from the repository, never a card.
     */
    price: defaultProductUnitPrice({
      price: product.price,
      weights: product.weights,
      // A module the shop has switched off is not priced, so a card must not
      // show its surcharge either — the server would not charge it.
      variantGroups: variantGroupsEnabledBy(product.variantGroups ?? [], modules),
    }),
    compareAtPrice: product.compareAtPrice,
    badge: product.badge,
    rating: product.rating,
    reviewCount: product.reviewCount,
    inStock: product.inStock,
    description: "", // required by the type; never rendered on a card
    // Filter inputs.
    occasions: product.occasions,
    isEggless: product.isEggless,
    flavours: product.flavours,
    weights: product.weights?.map((tier) => ({ label: tier.label, price: 0 })),
  };
}

/**
 * The modules this shop sells, for pricing a card.
 *
 * Defaults are every module ON, so a settings document written before these
 * switches existed — or a database that cannot be reached — prices exactly as
 * it did before rather than silently dropping surcharges.
 */
async function readModuleSettings(): Promise<ModuleSettings> {
  try {
    const settings = (await getSettings()) as unknown as {
      modules?: Partial<ModuleSettings>;
    };
    return { ...defaultModuleSettings, ...(settings.modules ?? {}) };
  } catch {
    return defaultModuleSettings;
  }
}

export async function getStorefrontProductCards(): Promise<LandingProduct[]> {
  const [products, modules] = await Promise.all([getStorefrontProducts(), readModuleSettings()]);
  return products.map((product) => toCard(product, modules));
}

export async function getStorefrontProductBySlug(
  slug: string
): Promise<LandingProduct | null> {
  const product = await getProductBySlug(slug);
  if (!product || product.status !== "published") return null;
  return mapAdminProductToStorefront(product, await categoryNames());
}

/**
 * Mutations address ONE document.
 *
 * They used to go through `mutateProducts`: read the whole collection, change
 * one entry, and write every document back. An in-process queue serialised those
 * against each other, but two writers are not in it — order placement, which
 * does `$inc` on `stockQuantity` inside a transaction, and inventory
 * adjustments, which use `patchFields`. So a cake sold during an admin's save
 * had its stock restored by that save: three cakes gone, stock unchanged, and
 * the shop overselling with nothing to show for it. Bulk Publish over ten rows
 * did it ten times.
 */

function nextId(): string {
  // `Date.now()` plus a per-process counter collides across instances: two
  // servers minting an id in the same millisecond both start their counter at 1.
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `product-${unique}`;
}

export async function createProduct(data: ProductFormData): Promise<Product> {
  const timestamp = nowIso();
  return productRepo.insertOne({
    ...data,
    id: nextId(),
    // Owned by the reviews aggregate, exactly as `updateProduct` below already
    // insists. This wrote the form's values verbatim, and the new-product form
    // defaulted to 4.5 — so every cake an admin added went on sale advertising
    // "4.5 ★" on its card and its product page, with no reviews behind it and
    // nothing the admin did to claim it. A shop's first honest review then
    // DROPPED the visible rating, because the aggregate replaced the invented
    // number with the real one.
    rating: 0,
    reviewCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as Product);
}

export async function updateProduct(
  id: string,
  data: ProductFormData
): Promise<Product | null> {
  const existing = await getProductById(id);
  if (!existing) return null;

  return productRepo.replaceOne(id, {
    ...existing,
    ...data,
    id,
    // `rating` and `reviewCount` are owned by the reviews aggregate, which
    // writes them directly. Letting an edit form carry its stale copy back would
    // undo a moderation decision made since this form was opened.
    rating: existing.rating,
    reviewCount: existing.reviewCount,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  });
}

/**
 * Delete a product and everything that only existed because of it.
 *
 * Its reviews and stock-history rows used to stay behind, keyed by a slug and an
 * id nothing resolves. They still counted toward the review aggregate and the
 * History view, and — because the slug is free again — a NEW cake created with
 * the same slug inherited the deleted product's reviews and star rating.
 *
 * Best-effort on the cascade: a product the admin asked to remove must not
 * survive because a follow-up cleanup failed.
 */
export async function deleteProduct(id: string): Promise<boolean> {
  const existing = await getProductById(id);
  const removed = await productRepo.deleteOne(id);
  if (!removed || !existing) return removed;

  try {
    await purgeProductTraces(existing.slug, existing.id);
  } catch (error) {
    console.error(`[products] could not clean up after deleting ${existing.slug}`, error);
  }
  return true;
}

/** Publish or archive many products in one statement. */
export async function setProductStatus(
  ids: string[],
  status: Product["status"]
): Promise<number> {
  if (ids.length === 0) return 0;
  return productRepo.setStatusMany(ids, status);
}

/**
 * Homepage product rails, built on the server.
 *
 * The section renderer used to call the browser catalogue directly during
 * render, so the server pass produced seed data and the client swapped it after
 * hydration. Building the rails here keeps both passes identical.
 */
export async function getHomepageRails(
  maxCount = 8
): Promise<Record<HomepageProductSource, LandingProduct[]>> {
  const [products, names, modules] = await Promise.all([
    readProducts(),
    categoryNames(),
    readModuleSettings(),
  ]);
  const all = products
    .filter((product) => product.status === "published")
    .map((product) => mapAdminProductToStorefront(product, names));

  const sources: HomepageProductSource[] = [
    "featured",
    "trending",
    "best-sellers",
    "photo-cakes",
    "eggless",
    "seasonal",
  ];

  return Object.fromEntries(
    sources.map((source) => [
      source,
      buildHomepageProducts(source, maxCount, products, all).map((product) => toCard(product, modules)),
    ])
  ) as Record<HomepageProductSource, LandingProduct[]>;
}
