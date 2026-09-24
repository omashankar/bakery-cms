import { safeSetItem } from "@/lib/safe-storage";
import type {
  ProductCategory,
  ProductCollection,
  ProductOccasion,
} from "@/types/product";
import type { CatalogStore, CatalogTab } from "@/types/catalog";
import { slugify } from "@/utils/slug";
import {
  defaultCatalogStore,
  defaultCategories,
  defaultCollections,
  defaultOccasions,
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
  safeSetItem(STORAGE_KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(CATALOG_UPDATED_EVENT));
}

function mergeStore(partial: Partial<CatalogStore>): CatalogStore {
  return {
    categories: partial.categories ?? defaultCategories,
    occasions: partial.occasions ?? defaultOccasions,
    collections: partial.collections ?? defaultCollections,
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


export function getOccasions(): ProductOccasion[] {
  return loadCatalogStore().occasions;
}

export function getCollections(): ProductCollection[] {
  return loadCatalogStore().collections;
}

/*
  `getWeightOptions` and its three writers stood here. Sizes are typed on the
  product now — the shop-wide list forced one product's sizes onto every other,
  and once products stopped deriving from it, editing it changed nothing a
  customer could see.
*/

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
  else safeSetItem(STORAGE_KEY, previousRaw);
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
  // with `void`. Categories and occasions are what the
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

/*
  The collection quartet, copied from the occasion one above rather than
  written fresh — same `hydratedStore()` gate, same `updateStore` replace-all,
  same WriteResult shape. The gate is the part that matters: without it a
  write composed from a cold browser cache publishes an empty list over the
  shop's real one.
*/
export async function createCollection(
  data: Omit<ProductCollection, "id" | "createdAt" | "updatedAt">,
): Promise<WriteResult<ProductCollection | null>> {
  const store = await hydratedStore();
  if (!store) return { value: null, persisted: false };

  const item: ProductCollection = {
    ...data,
    id: newId("col"),
    slug: data.slug || slugify(data.name),
    // Never undefined. The storefront resolver maps over this, and an absent
    // array would throw on a collection created and not yet filled.
    productIds: data.productIds ?? [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const { persisted } = await updateStore(store, {
    collections: [...store.collections, item],
  });
  return { value: item, persisted };
}

export async function updateCollection(
  id: string,
  patch: Partial<ProductCollection>,
): Promise<WriteResult<ProductCollection | null>> {
  const store = await hydratedStore();
  if (!store) return { value: null, persisted: false };

  const index = store.collections.findIndex((item) => item.id === id);
  if (index < 0) return { value: null, persisted: false };
  const next = [...store.collections];
  next[index] = { ...next[index], ...patch, updatedAt: nowIso() };
  const { persisted } = await updateStore(store, { collections: next });
  return { value: next[index], persisted };
}

export async function deleteCollections(ids: string[]): Promise<WriteResult<number>> {
  const store = await hydratedStore();
  if (!store) return { value: 0, persisted: false };

  const next = store.collections.filter((item) => !ids.includes(item.id));
  const { persisted } = await updateStore(store, { collections: next });
  return { value: persisted ? store.collections.length - next.length : 0, persisted };
}

/**
 * Put one product in exactly these collections, and in no others.
 *
 * MEMBERSHIP STILL LIVES ON THE COLLECTION. There is no `collectionIds` on a
 * product and this does not add one: two copies of one fact drift, and the
 * cost of keeping them in step is paid on every screen that writes either. So
 * the product form edits the same `productIds` the Catalog screen does, from
 * the other end — which is what makes both directions the same edit rather
 * than two features that agree by hand.
 *
 * ADDED AT THE END, never inserted. The order of `productIds` IS the curation
 * — a shop puts its best seller first — so a product ticked on its own form
 * joins the back of the queue rather than displacing whatever the shop put at
 * the front. Removing takes it out and leaves the rest in order.
 *
 * ONE write for every collection that changed, and none for the ones that did
 * not: each section is a replace-all, so touching a collection the owner did
 * not mean to touch is how a curated order gets rewritten by a product save.
 *
 * The reconciliation itself is `collectionsWithProduct` below — a pure
 * function, so what it decides can be tested without a browser, a cache or a
 * server, which is the half of this that has rules worth pinning.
 */
export function collectionsWithProduct(
  collections: readonly ProductCollection[],
  productId: string,
  collectionIds: readonly string[],
): { next: ProductCollection[]; changed: number } {
  const wanted = new Set(collectionIds);
  let changed = 0;

  const next = collections.map((collection) => {
    const ids = collection.productIds ?? [];
    const has = ids.includes(productId);
    const should = wanted.has(collection.id);
    /*
      UNTOUCHED when nothing changes, and the identity matters: each section is
      a replace-all write, so a collection rebuilt for no reason is a curated
      order rewritten by a product save that had nothing to do with it.
    */
    if (has === should) return collection;

    changed += 1;
    return {
      ...collection,
      /* Appended, never inserted — see the note on the caller. */
      productIds: should ? [...ids, productId] : ids.filter((id) => id !== productId),
    };
  });

  return { next, changed };
}

export async function setProductCollections(
  productId: string,
  collectionIds: readonly string[],
): Promise<WriteResult<number>> {
  const store = await hydratedStore();
  if (!store) return { value: 0, persisted: false };

  const { next, changed } = collectionsWithProduct(store.collections, productId, collectionIds);
  /* Nothing to say to the server, and nothing to roll back if it refuses. */
  if (changed === 0) return { value: 0, persisted: true };

  const { persisted } = await updateStore(store, { collections: next });
  return { value: persisted ? changed : 0, persisted };
}

/**
 * Which collections hold this product. The read half of the pair above.
 *
 * Reads the CACHE rather than waiting for hydration, because it answers a
 * render: the product form draws its ticks from this on first paint and again
 * whenever the catalog event fires. A cold cache means no ticks for a moment,
 * which the sync then corrects — the same way the category and occasion lists
 * on that form already behave.
 */
export function collectionsHolding(productId: string): string[] {
  return getCollections()
    .filter((collection) => (collection.productIds ?? []).includes(productId))
    .map((collection) => collection.id);
}

/**
 * Move ONE row up or down within its list, and write the order down.
 *
 * Order used to be whatever order the rows were created in, which is the one
 * thing a shop cannot change without deleting and recreating a row — and
 * deleting a category leaves every product filed under it pointing at nothing.
 *
 * NUMBERS THE WHOLE LIST, not just the pair that moved. `sortOrder` is optional
 * and most rows have never had one, so swapping two numbers where neither
 * exists writes 0 and 1 onto two rows and leaves the other nine unnumbered —
 * which the reader sorts AFTER them, so a row moved down would jump to the top.
 * Writing every index makes the stored order and the shown order the same list.
 *
 * The shown order is what it renumbers, not the stored array: the reader sorts
 * and de-dupes before the admin ever sees a row, so renumbering the raw array
 * would move whichever rows the shop is not looking at.
 */
export async function moveCatalogRow(
  section: CatalogTab,
  id: string,
  direction: -1 | 1,
): Promise<WriteResult<boolean>> {
  const store = await hydratedStore();
  if (!store) return { value: false, persisted: false };

  /*
    The three lists hold three different shapes and this only touches what they
    share, so it works on the common one and puts the rows back untyped. The
    alternative is the same twenty lines written out three times.
  */
  const rows = store[section] as { id: string; sortOrder?: number }[];
  const shown = [...rows].sort((a, b) => {
    const left = typeof a.sortOrder === "number" ? a.sortOrder : Number.POSITIVE_INFINITY;
    const right = typeof b.sortOrder === "number" ? b.sortOrder : Number.POSITIVE_INFINITY;
    if (left !== right) return left - right;
    return rows.indexOf(a) - rows.indexOf(b);
  });

  const at = shown.findIndex((row) => row.id === id);
  const to = at + direction;
  /* The ends are not an error — the button is simply disabled there. */
  if (at < 0 || to < 0 || to >= shown.length) return { value: false, persisted: false };

  [shown[at], shown[to]] = [shown[to]!, shown[at]!];

  const next = shown.map((row, index) => ({ ...row, sortOrder: index }));
  const { persisted } = await updateStore(store, {
    [section]: next,
  } as Partial<CatalogStore>);
  return { value: persisted, persisted };
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

