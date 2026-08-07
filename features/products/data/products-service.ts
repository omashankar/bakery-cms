import {
  mapAdminProductToStorefront,
  type TaxonomyNames,
} from "@/features/products/lib/product-mapper";
import { getCatalog } from "@/features/catalog/server/catalog.service";
import { readProducts } from "@/features/products/data/products-store.server";
import * as productRepo from "@/features/products/server/product.repository";
import type { LandingProduct } from "@/constants/landing-data";
import type { Product, ProductFormData } from "@/types/product";
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
 * Card-shaped projection: only the fields a product rail renders.
 *
 * Rails are handed to a Client Component, so every field crosses the wire in the
 * RSC payload. Sending whole products would ship descriptions, variant groups
 * and weight tables that no card displays — fine at 25 products, ruinous at
 * 5,000.
 */
function toCard(product: LandingProduct): LandingProduct {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    image: product.image,
    category: product.category,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    badge: product.badge,
    rating: product.rating,
    reviewCount: product.reviewCount,
    inStock: product.inStock,
    description: "", // required by the type; never rendered on a card
  };
}

export async function getStorefrontProductCards(): Promise<LandingProduct[]> {
  return (await getStorefrontProducts()).map(toCard);
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

export async function deleteProduct(id: string): Promise<boolean> {
  return productRepo.deleteOne(id);
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
  const [products, names] = await Promise.all([readProducts(), categoryNames()]);
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
      buildHomepageProducts(source, maxCount, products, all).map(toCard),
    ])
  ) as Record<HomepageProductSource, LandingProduct[]>;
}
