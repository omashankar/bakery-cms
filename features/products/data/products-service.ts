import { mapAdminProductToStorefront } from "@/features/products/lib/product-mapper";
import { mutateProducts, readProducts } from "@/features/products/data/products-store.server";
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
  const products = await readProducts();
  return products
    .filter((product) => product.status === "published")
    .map(mapAdminProductToStorefront);
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
  return mapAdminProductToStorefront(product);
}

// Mutations go through mutateProducts so the read and the write happen under one
// lock. See products-store.server.ts for why splitting them loses updates.

let idCounter = 0;

function nextId(): string {
  // Date.now() alone collides when two products are created in the same tick.
  idCounter += 1;
  return `product-${Date.now()}-${idCounter}`;
}

export async function createProduct(data: ProductFormData): Promise<Product> {
  return mutateProducts((products) => {
    const timestamp = nowIso();
    const product: Product = {
      ...data,
      id: nextId(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    return { next: [product, ...products], result: product };
  });
}

export async function updateProduct(
  id: string,
  data: ProductFormData
): Promise<Product | null> {
  return mutateProducts((products) => {
    const index = products.findIndex((product) => product.id === id);
    if (index === -1) return { next: products, result: null };

    const updated: Product = {
      ...products[index],
      ...data,
      id,
      updatedAt: nowIso(),
    };

    const next = [...products];
    next[index] = updated;
    return { next, result: updated };
  });
}

export async function deleteProduct(id: string): Promise<boolean> {
  return mutateProducts((products) => {
    const next = products.filter((product) => product.id !== id);
    return { next, result: next.length !== products.length };
  });
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
  const products = await readProducts();
  const all = products
    .filter((product) => product.status === "published")
    .map(mapAdminProductToStorefront);

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
