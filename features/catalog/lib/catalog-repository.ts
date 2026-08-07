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
import {
  pushCatalogSection,
  resetCatalogSection,
  catalogHydration,
  CATALOG_SECTIONS,
} from "./catalog-api";
import type { WriteResult } from "@/lib/write-result";

const STORAGE_KEY = "bakery-cms-catalog";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * An id no other item can share.
 *
 * These were `${prefix}-${Date.now()}`, which collides for two items added in
 * the same millisecond and, more likely, for two admins adding a category at the
 * same moment on different machines — each section is a replace-all, so the
 * second write would silently absorb the first under one id.
 */
function newId(prefix: string): string {
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${unique}`;
}

/**
 * Fired whenever the cached taxonomy changes — including when hydration
 * replaces it with the server's.
 *
 * The Catalog screen read localStorage once at mount and never again, so on a
 * fresh browser it rendered the shipped defaults for the whole visit while
 * `CatalogServerSync` quietly corrected the cache underneath it. Selecting a row
 * from that stale list and deleting it then addressed an id the server had never
 * heard of.
 */
export const CATALOG_UPDATED_EVENT = "bakery-catalog-updated";

function persist(store: CatalogStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(CATALOG_UPDATED_EVENT));
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

/**
 * The cached taxonomy. Reading it does NOT write it.
 *
 * An absent key used to be answered by persisting `defaultCatalogStore` and
 * returning it, so the first read on a fresh browser planted the demo seed in
 * localStorage — and every later write composed its replace-all payload from
 * there. A read that writes is also what made the seed outlive
 * `CatalogServerSync`: the sync's own `loadCatalogStore()` created it before the
 * server's copy had arrived to replace it.
 */
export function loadCatalogStore(): CatalogStore {
  if (typeof window === "undefined") return defaultCatalogStore;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultCatalogStore;

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

/**
 * Reset every section to the shipped defaults, on the server first.
 *
 * This used to be synchronous and browser-only — it cleared localStorage, wrote
 * the client defaults back, and returned. The screen then PUT those defaults up
 * separately, which recorded the most destructive action in the product of an
 * ordinary edit and left the two halves able to disagree.
 *
 * The server is asked first and the cache follows only what it accepted, so a
 * refused reset leaves this browser holding the taxonomy that is really in place
 * rather than the defaults it wanted.
 */
export async function resetCatalogStore(): Promise<WriteResult<CatalogStore>> {
  const results = await Promise.all(CATALOG_SECTIONS.map((s) => resetCatalogSection(s)));
  const persisted = results.every(Boolean);

  if (!persisted) return { value: loadCatalogStore(), persisted: false };

  const reset = saveCatalogStore(defaultCatalogStore);
  return { value: reset, persisted: true };
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

/**
 * The taxonomy, but only once the server's copy has actually arrived.
 *
 * Null means the gate never opened and NOTHING may be published. Every mutation
 * starts here, and that ordering is the entire point: `pushCatalogSection` also
 * waits for the gate, but the payload used to be composed before it — read the
 * cache, build the replace-all body, and only then wait. On a cold load the
 * cache held the demo seed, so the wait finished and the demo taxonomy was sent
 * over the shop's real one. The gate has to guard the READ.
 */
async function hydratedStore(): Promise<CatalogStore | null> {
  if (!(await catalogHydration.waitForSettled())) return null;
  return loadCatalogStore();
}

/** Restore the cache, but only if this write is still the one in it. */
function rollBackCache(previousRaw: string | null, attempted: CatalogStore): void {
  if (typeof window === "undefined") return;

  // Restoring unconditionally would destroy a concurrent save the server DID
  // accept between this write and its refusal.
  if (localStorage.getItem(STORAGE_KEY) !== JSON.stringify(attempted)) return;

  if (previousRaw === null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, previousRaw);
}

/**
 * Apply a patch to an ALREADY-HYDRATED store and publish it.
 *
 * `current` is passed in rather than read here so that a caller cannot compose
 * its patch from an ungated read — the type makes the ordering the only option.
 */
async function updateStore(
  current: CatalogStore,
  patch: Partial<CatalogStore>
): Promise<WriteResult<CatalogStore>> {
  const previousRaw = typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
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

  const persisted = results.every(Boolean);
  // A refused write left in the cache is worse than a lost edit: the next
  // ACCEPTED write to any section publishes the whole store, carrying the
  // refused change to the server by the back door.
  if (!persisted) rollBackCache(previousRaw, saved);

  return { value: persisted ? saved : current, persisted };
}

export async function createCategory(
  data: Omit<ProductCategory, "id" | "createdAt" | "updatedAt">
): Promise<WriteResult<ProductCategory | null>> {
  const store = await hydratedStore();
  if (!store) return { value: null, persisted: false };

  const item: ProductCategory = {
    ...data,
    id: newId("cat"),
    slug: data.slug || slugify(data.name),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const { persisted } = await updateStore(store, { categories: [...store.categories, item] });
  return { value: item, persisted };
}

export async function updateCategory(
  id: string,
  patch: Partial<ProductCategory>
): Promise<WriteResult<ProductCategory | null>> {
  const store = await hydratedStore();
  if (!store) return { value: null, persisted: false };

  const index = store.categories.findIndex((item) => item.id === id);
  if (index < 0) return { value: null, persisted: false };
  const next = [...store.categories];
  next[index] = { ...next[index], ...patch, updatedAt: nowIso() };
  const { persisted } = await updateStore(store, { categories: next });
  return { value: next[index], persisted };
}

export async function deleteCategories(ids: string[]): Promise<WriteResult<number>> {
  const store = await hydratedStore();
  if (!store) return { value: 0, persisted: false };

  const next = store.categories.filter((item) => !ids.includes(item.id));
  const { persisted } = await updateStore(store, { categories: next });
  return { value: persisted ? store.categories.length - next.length : 0, persisted };
}

export async function createFlavour(
  data: Omit<ProductFlavour, "id" | "createdAt" | "updatedAt">
): Promise<WriteResult<ProductFlavour | null>> {
  const store = await hydratedStore();
  if (!store) return { value: null, persisted: false };

  const item: ProductFlavour = {
    ...data,
    id: newId("fl"),
    slug: data.slug || slugify(data.name),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const { persisted } = await updateStore(store, { flavours: [...store.flavours, item] });
  return { value: item, persisted };
}

export async function updateFlavour(
  id: string,
  patch: Partial<ProductFlavour>
): Promise<WriteResult<ProductFlavour | null>> {
  const store = await hydratedStore();
  if (!store) return { value: null, persisted: false };

  const index = store.flavours.findIndex((item) => item.id === id);
  if (index < 0) return { value: null, persisted: false };
  const next = [...store.flavours];
  next[index] = { ...next[index], ...patch, updatedAt: nowIso() };
  const { persisted } = await updateStore(store, { flavours: next });
  return { value: next[index], persisted };
}

export async function deleteFlavours(ids: string[]): Promise<WriteResult<number>> {
  const store = await hydratedStore();
  if (!store) return { value: 0, persisted: false };

  const next = store.flavours.filter((item) => !ids.includes(item.id));
  const { persisted } = await updateStore(store, { flavours: next });
  return { value: persisted ? store.flavours.length - next.length : 0, persisted };
}

export async function createOccasion(
  data: Omit<ProductOccasion, "id" | "createdAt" | "updatedAt">
): Promise<WriteResult<ProductOccasion | null>> {
  const store = await hydratedStore();
  if (!store) return { value: null, persisted: false };

  const item: ProductOccasion = {
    ...data,
    id: newId("oc"),
    slug: data.slug || slugify(data.name),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const { persisted } = await updateStore(store, { occasions: [...store.occasions, item] });
  return { value: item, persisted };
}

export async function updateOccasion(
  id: string,
  patch: Partial<ProductOccasion>
): Promise<WriteResult<ProductOccasion | null>> {
  const store = await hydratedStore();
  if (!store) return { value: null, persisted: false };

  const index = store.occasions.findIndex((item) => item.id === id);
  if (index < 0) return { value: null, persisted: false };
  const next = [...store.occasions];
  next[index] = { ...next[index], ...patch, updatedAt: nowIso() };
  const { persisted } = await updateStore(store, { occasions: next });
  return { value: next[index], persisted };
}

export async function deleteOccasions(ids: string[]): Promise<WriteResult<number>> {
  const store = await hydratedStore();
  if (!store) return { value: 0, persisted: false };

  const next = store.occasions.filter((item) => !ids.includes(item.id));
  const { persisted } = await updateStore(store, { occasions: next });
  return { value: persisted ? store.occasions.length - next.length : 0, persisted };
}

export async function createWeightOption(
  data: Omit<CatalogWeightOption, "id" | "createdAt" | "updatedAt" | "sortOrder"> & {
    sortOrder?: number;
  }
): Promise<WriteResult<CatalogWeightOption | null>> {
  const store = await hydratedStore();
  if (!store) return { value: null, persisted: false };

  const item: CatalogWeightOption = {
    ...data,
    id: newId("wt"),
    sortOrder: data.sortOrder ?? store.weights.length + 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const { persisted } = await updateStore(store, { weights: [...store.weights, item] });
  return { value: item, persisted };
}

export async function updateWeightOption(
  id: string,
  patch: Partial<CatalogWeightOption>
): Promise<WriteResult<CatalogWeightOption | null>> {
  const store = await hydratedStore();
  if (!store) return { value: null, persisted: false };

  const index = store.weights.findIndex((item) => item.id === id);
  if (index < 0) return { value: null, persisted: false };
  const next = [...store.weights];
  next[index] = { ...next[index], ...patch, updatedAt: nowIso() };
  const { persisted } = await updateStore(store, { weights: next });
  return { value: next[index], persisted };
}

export async function deleteWeightOptions(ids: string[]): Promise<WriteResult<number>> {
  const store = await hydratedStore();
  if (!store) return { value: 0, persisted: false };

  const next = store.weights.filter((item) => !ids.includes(item.id));
  const { persisted } = await updateStore(store, { weights: next });
  return { value: persisted ? store.weights.length - next.length : 0, persisted };
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
