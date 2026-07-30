import type { ProductCategory, ProductFlavour, ProductOccasion } from "@/types/product";
import type { CatalogStore, CatalogWeightOption } from "@/types/catalog";
import { slugify } from "@/utils/slug";
import {
  defaultCatalogStore,
  defaultCategories,
  defaultFlavours,
  defaultOccasions,
  defaultWeightOptions,
} from "./catalog-utils";
import { pushCatalogSection, CATALOG_SECTIONS } from "./catalog-api";
import type { WriteResult } from "@/lib/write-result";

const STORAGE_KEY = "bakery-cms-catalog";

function nowIso(): string {
  return new Date().toISOString();
}

function persist(store: CatalogStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function mergeStore(partial: Partial<CatalogStore>): CatalogStore {
  return {
    categories: partial.categories ?? defaultCategories,
    flavours: partial.flavours ?? defaultFlavours,
    occasions: partial.occasions ?? defaultOccasions,
    weights: partial.weights ?? defaultWeightOptions,
    updatedAt: partial.updatedAt ?? nowIso(),
  };
}

export function loadCatalogStore(): CatalogStore {
  if (typeof window === "undefined") return defaultCatalogStore;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    persist(defaultCatalogStore);
    return defaultCatalogStore;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CatalogStore>;
    return mergeStore(parsed);
  } catch {
    return defaultCatalogStore;
  }
}

export function saveCatalogStore(store: CatalogStore): CatalogStore {
  const next = { ...store, updatedAt: nowIso() };
  persist(next);
  return next;
}

export function resetCatalogStore(): CatalogStore {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    persist(defaultCatalogStore);
  }
  return defaultCatalogStore;
}

export function getCategories(): ProductCategory[] {
  return loadCatalogStore().categories;
}

export function getFlavours(): ProductFlavour[] {
  return loadCatalogStore().flavours;
}

export function getOccasions(): ProductOccasion[] {
  return loadCatalogStore().occasions;
}

export function getWeightOptions(): CatalogWeightOption[] {
  return [...loadCatalogStore().weights].sort((a, b) => a.sortOrder - b.sortOrder);
}

async function updateStore(
  patch: Partial<CatalogStore>
): Promise<WriteResult<CatalogStore>> {
  const current = loadCatalogStore();
  const saved = saveCatalogStore({ ...current, ...patch });

  // `pushCatalogSection` already returned a boolean; this used to discard it
  // with `void`. Categories, flavours, occasions and weights are what the
  // product form and the storefront filters are built from, so a section the
  // server refused leaves the admin editing a taxonomy nobody else has.
  const sections = Object.keys(patch).filter((key) =>
    (CATALOG_SECTIONS as readonly string[]).includes(key)
  );
  const results = await Promise.all(
    sections.map((key) => pushCatalogSection(key, saved[key as keyof CatalogStore]))
  );

  return { value: saved, persisted: results.every(Boolean) };
}

export async function createCategory(
  data: Omit<ProductCategory, "id" | "createdAt" | "updatedAt">
): Promise<WriteResult<ProductCategory>> {
  const store = loadCatalogStore();
  const item: ProductCategory = {
    ...data,
    id: `cat-${Date.now()}`,
    slug: data.slug || slugify(data.name),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const { persisted } = await updateStore({ categories: [...store.categories, item] });
  return { value: item, persisted };
}

export async function updateCategory(
  id: string,
  patch: Partial<ProductCategory>
): Promise<WriteResult<ProductCategory | null>> {
  const store = loadCatalogStore();
  const index = store.categories.findIndex((item) => item.id === id);
  if (index < 0) return { value: null, persisted: false };
  const next = [...store.categories];
  next[index] = { ...next[index], ...patch, updatedAt: nowIso() };
  const { persisted } = await updateStore({ categories: next });
  return { value: next[index], persisted };
}

export async function deleteCategories(ids: string[]): Promise<WriteResult<number>> {
  const store = loadCatalogStore();
  const next = store.categories.filter((item) => !ids.includes(item.id));
  const { persisted } = await updateStore({ categories: next });
  return { value: store.categories.length - next.length, persisted };
}

export async function createFlavour(
  data: Omit<ProductFlavour, "id" | "createdAt" | "updatedAt">
): Promise<WriteResult<ProductFlavour>> {
  const store = loadCatalogStore();
  const item: ProductFlavour = {
    ...data,
    id: `fl-${Date.now()}`,
    slug: data.slug || slugify(data.name),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const { persisted } = await updateStore({ flavours: [...store.flavours, item] });
  return { value: item, persisted };
}

export async function updateFlavour(
  id: string,
  patch: Partial<ProductFlavour>
): Promise<WriteResult<ProductFlavour | null>> {
  const store = loadCatalogStore();
  const index = store.flavours.findIndex((item) => item.id === id);
  if (index < 0) return { value: null, persisted: false };
  const next = [...store.flavours];
  next[index] = { ...next[index], ...patch, updatedAt: nowIso() };
  const { persisted } = await updateStore({ flavours: next });
  return { value: next[index], persisted };
}

export async function deleteFlavours(ids: string[]): Promise<WriteResult<number>> {
  const store = loadCatalogStore();
  const next = store.flavours.filter((item) => !ids.includes(item.id));
  const { persisted } = await updateStore({ flavours: next });
  return { value: store.flavours.length - next.length, persisted };
}

export async function createOccasion(
  data: Omit<ProductOccasion, "id" | "createdAt" | "updatedAt">
): Promise<WriteResult<ProductOccasion>> {
  const store = loadCatalogStore();
  const item: ProductOccasion = {
    ...data,
    id: `oc-${Date.now()}`,
    slug: data.slug || slugify(data.name),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const { persisted } = await updateStore({ occasions: [...store.occasions, item] });
  return { value: item, persisted };
}

export async function updateOccasion(
  id: string,
  patch: Partial<ProductOccasion>
): Promise<WriteResult<ProductOccasion | null>> {
  const store = loadCatalogStore();
  const index = store.occasions.findIndex((item) => item.id === id);
  if (index < 0) return { value: null, persisted: false };
  const next = [...store.occasions];
  next[index] = { ...next[index], ...patch, updatedAt: nowIso() };
  const { persisted } = await updateStore({ occasions: next });
  return { value: next[index], persisted };
}

export async function deleteOccasions(ids: string[]): Promise<WriteResult<number>> {
  const store = loadCatalogStore();
  const next = store.occasions.filter((item) => !ids.includes(item.id));
  const { persisted } = await updateStore({ occasions: next });
  return { value: store.occasions.length - next.length, persisted };
}

export async function createWeightOption(
  data: Omit<CatalogWeightOption, "id" | "createdAt" | "updatedAt" | "sortOrder"> & {
    sortOrder?: number;
  }
): Promise<WriteResult<CatalogWeightOption>> {
  const store = loadCatalogStore();
  const item: CatalogWeightOption = {
    ...data,
    id: `wt-${Date.now()}`,
    sortOrder: data.sortOrder ?? store.weights.length + 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const { persisted } = await updateStore({ weights: [...store.weights, item] });
  return { value: item, persisted };
}

export async function updateWeightOption(
  id: string,
  patch: Partial<CatalogWeightOption>
): Promise<WriteResult<CatalogWeightOption | null>> {
  const store = loadCatalogStore();
  const index = store.weights.findIndex((item) => item.id === id);
  if (index < 0) return { value: null, persisted: false };
  const next = [...store.weights];
  next[index] = { ...next[index], ...patch, updatedAt: nowIso() };
  const { persisted } = await updateStore({ weights: next });
  return { value: next[index], persisted };
}

export async function deleteWeightOptions(ids: string[]): Promise<WriteResult<number>> {
  const store = loadCatalogStore();
  const next = store.weights.filter((item) => !ids.includes(item.id));
  const { persisted } = await updateStore({ weights: next });
  return { value: store.weights.length - next.length, persisted };
}

export function getCategoryById(id: string): ProductCategory | undefined {
  return getCategories().find((item) => item.id === id);
}

export function getCategoryByName(name: string): ProductCategory | undefined {
  const normalized = name.toLowerCase();
  return getCategories().find(
    (item) => item.name.toLowerCase() === normalized || item.slug === normalized
  );
}

export function getFlavourByName(name: string): ProductFlavour | undefined {
  const normalized = name.toLowerCase();
  return getFlavours().find(
    (item) => item.name.toLowerCase() === normalized || item.slug === normalized
  );
}
