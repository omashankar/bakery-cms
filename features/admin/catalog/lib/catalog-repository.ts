import type { CakeCategory, CakeFlavour, CakeOccasion } from "@/types/cake";
import type { CatalogStore, CatalogWeightOption } from "@/types/catalog";
import { slugify } from "@/utils/slug";
import {
  defaultCatalogStore,
  defaultCategories,
  defaultFlavours,
  defaultOccasions,
  defaultWeightOptions,
} from "./catalog-utils";

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

export function getCategories(): CakeCategory[] {
  return loadCatalogStore().categories;
}

export function getFlavours(): CakeFlavour[] {
  return loadCatalogStore().flavours;
}

export function getOccasions(): CakeOccasion[] {
  return loadCatalogStore().occasions;
}

export function getWeightOptions(): CatalogWeightOption[] {
  return [...loadCatalogStore().weights].sort((a, b) => a.sortOrder - b.sortOrder);
}

function updateStore(patch: Partial<CatalogStore>): CatalogStore {
  const current = loadCatalogStore();
  return saveCatalogStore({ ...current, ...patch });
}

export function createCategory(data: Omit<CakeCategory, "id" | "createdAt" | "updatedAt">): CakeCategory {
  const store = loadCatalogStore();
  const item: CakeCategory = {
    ...data,
    id: `cat-${Date.now()}`,
    slug: data.slug || slugify(data.name),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  updateStore({ categories: [...store.categories, item] });
  return item;
}

export function updateCategory(id: string, patch: Partial<CakeCategory>): CakeCategory | null {
  const store = loadCatalogStore();
  const index = store.categories.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const next = [...store.categories];
  next[index] = { ...next[index], ...patch, updatedAt: nowIso() };
  updateStore({ categories: next });
  return next[index];
}

export function deleteCategories(ids: string[]): number {
  const store = loadCatalogStore();
  const next = store.categories.filter((item) => !ids.includes(item.id));
  updateStore({ categories: next });
  return store.categories.length - next.length;
}

export function createFlavour(data: Omit<CakeFlavour, "id" | "createdAt" | "updatedAt">): CakeFlavour {
  const store = loadCatalogStore();
  const item: CakeFlavour = {
    ...data,
    id: `fl-${Date.now()}`,
    slug: data.slug || slugify(data.name),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  updateStore({ flavours: [...store.flavours, item] });
  return item;
}

export function updateFlavour(id: string, patch: Partial<CakeFlavour>): CakeFlavour | null {
  const store = loadCatalogStore();
  const index = store.flavours.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const next = [...store.flavours];
  next[index] = { ...next[index], ...patch, updatedAt: nowIso() };
  updateStore({ flavours: next });
  return next[index];
}

export function deleteFlavours(ids: string[]): number {
  const store = loadCatalogStore();
  const next = store.flavours.filter((item) => !ids.includes(item.id));
  updateStore({ flavours: next });
  return store.flavours.length - next.length;
}

export function createOccasion(data: Omit<CakeOccasion, "id" | "createdAt" | "updatedAt">): CakeOccasion {
  const store = loadCatalogStore();
  const item: CakeOccasion = {
    ...data,
    id: `oc-${Date.now()}`,
    slug: data.slug || slugify(data.name),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  updateStore({ occasions: [...store.occasions, item] });
  return item;
}

export function updateOccasion(id: string, patch: Partial<CakeOccasion>): CakeOccasion | null {
  const store = loadCatalogStore();
  const index = store.occasions.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const next = [...store.occasions];
  next[index] = { ...next[index], ...patch, updatedAt: nowIso() };
  updateStore({ occasions: next });
  return next[index];
}

export function deleteOccasions(ids: string[]): number {
  const store = loadCatalogStore();
  const next = store.occasions.filter((item) => !ids.includes(item.id));
  updateStore({ occasions: next });
  return store.occasions.length - next.length;
}

export function createWeightOption(
  data: Omit<CatalogWeightOption, "id" | "createdAt" | "updatedAt" | "sortOrder"> & {
    sortOrder?: number;
  }
): CatalogWeightOption {
  const store = loadCatalogStore();
  const item: CatalogWeightOption = {
    ...data,
    id: `wt-${Date.now()}`,
    sortOrder: data.sortOrder ?? store.weights.length + 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  updateStore({ weights: [...store.weights, item] });
  return item;
}

export function updateWeightOption(
  id: string,
  patch: Partial<CatalogWeightOption>
): CatalogWeightOption | null {
  const store = loadCatalogStore();
  const index = store.weights.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const next = [...store.weights];
  next[index] = { ...next[index], ...patch, updatedAt: nowIso() };
  updateStore({ weights: next });
  return next[index];
}

export function deleteWeightOptions(ids: string[]): number {
  const store = loadCatalogStore();
  const next = store.weights.filter((item) => !ids.includes(item.id));
  updateStore({ weights: next });
  return store.weights.length - next.length;
}

export function getCategoryById(id: string): CakeCategory | undefined {
  return getCategories().find((item) => item.id === id);
}

export function getCategoryByName(name: string): CakeCategory | undefined {
  const normalized = name.toLowerCase();
  return getCategories().find(
    (item) => item.name.toLowerCase() === normalized || item.slug === normalized
  );
}

export function getFlavourByName(name: string): CakeFlavour | undefined {
  const normalized = name.toLowerCase();
  return getFlavours().find(
    (item) => item.name.toLowerCase() === normalized || item.slug === normalized
  );
}
