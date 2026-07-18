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
  adminFlavours,
  adminOccasions,
  getCategoryByName,
  getDefaultWeights,
  getFlavourByName,
} from "./catalog-options";
import { DEFAULT_PRODUCT_SHAPES } from "./product-mapper";
import { slugify } from "./product-utils";
import { createDefaultVariantGroups, normalizeVariantGroups } from "./variant-utils";

const STORAGE_KEY = "bakery-cms-admin-cakes";
const STORAGE_VERSION_KEY = "bakery-cms-admin-cakes-version";
/** v6: variant options carry an explicit `semantic`, backfilled from legacy labels. */
const CAKES_STORAGE_VERSION = 6;

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

  const flavour =
    getFlavourByName(cake.category) ??
    adminFlavours().find((item) =>
      cake.description.toLowerCase().includes(item.slug)
    );

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
    compareAtPrice: cake.price > 1000 ? Math.round(cake.price * 1.1) : undefined,
    images: [cake.image],
    categoryId: category.id,
    flavourId: flavour?.id,
    occasionIds,
    weights: getDefaultWeights(cake.price),
    status: index === 1 ? "draft" : "published",
    isFeatured: cake.badge === "Featured",
    isBestSeller: cake.badge === "Bestseller",
    isTrending: cake.badge === "Trending",
    isEggless: cake.isEggless ?? cake.category.toLowerCase().includes("eggless"),
    isPhotoCake: cake.category.toLowerCase().includes("photo"),
    isSeasonal: cake.category.toLowerCase().includes("seasonal"),
    shapes: [...DEFAULT_PRODUCT_SHAPES],
    flavourOptions: cake.flavours ?? [],
    stockStatus: cake.inStock === false ? "out_of_stock" : index % 5 === 0 ? "low_stock" : "in_stock",
    stockQuantity: cake.inStock === false ? 0 : index % 5 === 0 ? 6 : 50,
    unlimitedStock: false,
    lowStockThreshold: undefined,
    allowsMessage: true,
    allowsPhotoUpload: cake.category.toLowerCase().includes("photo"),
    ingredients: undefined,
    barcode: undefined,
    preparationTimeMinutes: cake.category.toLowerCase().includes("photo") ? 180 : 120,
    shelfLifeDays: 3,
    calories: 320,
    allergens: cake.isEggless
      ? "Contains milk, wheat. Prepared without eggs."
      : "Contains milk, wheat, eggs.",
    careInstructions: "Refrigerate within 2 hours. Serve at room temperature for best taste.",
    variantGroups: createDefaultVariantGroups({
      isEggless: cake.isEggless ?? cake.category.toLowerCase().includes("eggless"),
      isPhotoCake: cake.category.toLowerCase().includes("photo"),
    }),
    rating: cake.rating ?? 4.5,
    reviewCount: cake.reviewCount ?? 12,
    seo: {
      metaTitle: `${cake.name} | Monginis`,
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
    isEggless: cake.isEggless ?? false,
    isPhotoCake: cake.isPhotoCake ?? false,
    isSeasonal: cake.isSeasonal ?? false,
    shapes: cake.shapes?.length ? cake.shapes : [...DEFAULT_PRODUCT_SHAPES],
    flavourOptions: cake.flavourOptions ?? [],
    stockStatus: cake.stockStatus ?? "in_stock",
    stockQuantity: cake.stockQuantity ?? 50,
    unlimitedStock: cake.unlimitedStock ?? false,
    lowStockThreshold: cake.lowStockThreshold,
    allowsMessage: cake.allowsMessage ?? true,
    allowsPhotoUpload:
      cake.allowsPhotoUpload ?? cake.isPhotoCake ?? false,
    barcode: cake.barcode,
    preparationTimeMinutes: cake.preparationTimeMinutes,
    shelfLifeDays: cake.shelfLifeDays,
    calories: cake.calories,
    allergens: cake.allergens,
    careInstructions: cake.careInstructions,
    variantGroups,
    rating: cake.rating ?? 4.5,
    reviewCount: cake.reviewCount ?? 12,
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

export function loadProducts(): Product[] {
  if (typeof window === "undefined") return seedProducts();

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedProducts();
    persistProducts(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(CAKES_STORAGE_VERSION));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as Product[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = seedProducts();
      persistProducts(seeded);
      localStorage.setItem(STORAGE_VERSION_KEY, String(CAKES_STORAGE_VERSION));
      return seeded;
    }

    const storedVersion = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 1);
    const { cakes: normalized, changed } = normalizeProductImages(parsed);

    if (changed || storedVersion < CAKES_STORAGE_VERSION) {
      persistProducts(normalized);
      localStorage.setItem(STORAGE_VERSION_KEY, String(CAKES_STORAGE_VERSION));
    }

    return normalized;
  } catch {
    const seeded = seedProducts();
    persistProducts(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(CAKES_STORAGE_VERSION));
    return seeded;
  }
}

function persistProducts(cakes: Product[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cakes));
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
    flavourId: undefined,
    occasionIds: [],
    weights: getDefaultWeights(999),
    status: "draft",
    isFeatured: false,
    isBestSeller: false,
    isTrending: false,
    isEggless: false,
    isPhotoCake: false,
    isSeasonal: false,
    shapes: [...DEFAULT_PRODUCT_SHAPES],
    flavourOptions: [],
    stockStatus: "in_stock",
    stockQuantity: 50,
    unlimitedStock: false,
    lowStockThreshold: undefined,
    allowsMessage: true,
    allowsPhotoUpload: false,
    ingredients: "",
    barcode: "",
    preparationTimeMinutes: 120,
    shelfLifeDays: 3,
    calories: undefined,
    allergens: "",
    careInstructions: "",
    variantGroups: createDefaultVariantGroups(),
    rating: 4.5,
    reviewCount: 0,
    seo: {
      metaTitle: "",
      metaDescription: "",
    },
  };
}
