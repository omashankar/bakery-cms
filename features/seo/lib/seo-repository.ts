import { brandInfo } from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import { replaceSeoRequest } from "@/features/site-layout/lib/site-layout-api";
import type { WriteResult } from "@/lib/write-result";
import type { GlobalSeoSettings, SeoRouteEntry, SeoStore } from "@/types/seo";

const STORAGE_KEY = "bakery-cms-seo";
const STORAGE_VERSION_KEY = "bakery-cms-seo-version";
const SEO_STORAGE_VERSION = 1;

export const SEO_UPDATED_EVENT = "bakery-seo-updated";

function nowIso(): string {
  return new Date().toISOString();
}

const defaultOgImage =
  "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1200&h=630&fit=crop";

export function seedGlobal(): GlobalSeoSettings {
  return {
    siteName: brandInfo.name,
    titleSuffix: `| ${brandInfo.name}`,
    defaultDescription: brandInfo.description,
    defaultOgImage,
    defaultKeywords: [
      "bakery",
      "cakes",
      "monginis",
      "custom cakes",
      "wedding cakes",
      "pastries",
    ],
    canonicalBaseUrl: "https://www.monginis.example",
    allowIndexing: true,
    googleSiteVerification: "",
    defaultTwitterCard: "summary_large_image",
    twitterSite: "@monginis",
    twitterCreator: "@monginis",
    organizationSchemaJson: JSON.stringify(
      {
        "@context": "https://schema.org",
        "@type": "Bakery",
        name: brandInfo.name,
        description: brandInfo.description,
        url: "https://www.monginis.example/store",
      },
      null,
      2
    ),
  };
}

function route(
  routeKey: string,
  path: string,
  label: string,
  metaTitle: string,
  metaDescription: string,
  metaKeywords: string[] = [],
  noIndex = false,
  noFollow = false
): SeoRouteEntry {
  const timestamp = nowIso();
  return {
    id: `seo-${routeKey}`,
    routeKey,
    path,
    label,
    metaTitle,
    metaDescription,
    metaKeywords,
    ogImage: defaultOgImage,
    noIndex,
    noFollow,
    updatedAt: timestamp,
  };
}

function seedRoutes(): SeoRouteEntry[] {
  return [
    route(
      "store-home",
      routes.store.home,
      "Storefront Home",
      `${brandInfo.name} — Cakes & Pastries`,
      brandInfo.description,
      ["cakes", "bakery", "online cake order"]
    ),
    route(
      "store-collections",
      routes.store.collections,
      "Collections",
      "Cake Collections",
      "Browse all cake collections and categories.",
      ["cake collections", "birthday cakes", "premium cakes"]
    ),
    route(
      "store-wedding",
      routes.store.weddingCakes,
      "Wedding Cakes",
      "Wedding Cakes",
      "Elegant wedding cakes and custom celebration designs.",
      ["wedding cakes", "custom wedding cake"]
    ),
    route(
      "store-about",
      routes.store.about,
      "About",
      "About Us",
      "Our bakery story, heritage, and commitment to quality.",
      ["about monginis", "bakery story"]
    ),
    route(
      "store-contact",
      routes.store.contact,
      "Contact",
      "Contact",
      "Get in touch for orders, support, and custom cake inquiries.",
      ["contact bakery", "cake inquiry"]
    ),
    route(
      "store-faq",
      routes.store.faq,
      "FAQ",
      "FAQ",
      "Frequently asked questions about ordering, delivery, and our cakes.",
      ["bakery faq", "cake delivery"]
    ),
    route(
      "store-gallery",
      routes.store.gallery,
      "Gallery",
      "Gallery",
      "Explore our cake gallery, wedding designs, and celebration creations.",
      ["cake gallery", "bakery photos"]
    ),
    route(
      "store-privacy",
      routes.store.privacy,
      "Privacy Policy",
      "Privacy Policy",
      "How we collect, use, and protect your information.",
      ["privacy policy"]
    ),
    route(
      "store-terms",
      routes.store.terms,
      "Terms of Service",
      "Terms of Service",
      "Terms and conditions for using our bakery services.",
      ["terms of service"]
    ),
    route(
      "store-search",
      routes.store.search,
      "Search",
      "Search Cakes",
      "Search cakes, flavours, and categories across our bakery catalog.",
      ["search cakes"],
      true
    ),
    route(
      "store-thank-you",
      routes.store.thankYou,
      "Thank You",
      "Thank You",
      "Your inquiry has been submitted successfully.",
      [],
      true
    ),
  ];
}

export function seedStore(): SeoStore {
  return {
    global: seedGlobal(),
    routes: seedRoutes(),
  };
}

function persist(store: SeoStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  localStorage.setItem(STORAGE_VERSION_KEY, String(SEO_STORAGE_VERSION));
  window.dispatchEvent(new Event(SEO_UPDATED_EVENT));
}

let serverStore: SeoStore = seedStore();

export function loadSeoStore(): SeoStore {
  if (typeof window === "undefined") return serverStore;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedStore();
    persist(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as SeoStore;
    if (parsed?.global && Array.isArray(parsed.routes) && parsed.routes.length > 0) {
      const merged: SeoStore = {
        global: { ...seedGlobal(), ...parsed.global },
        routes: parsed.routes.map((entry) => ({
          ...entry,
          metaKeywords: entry.metaKeywords ?? [],
          noFollow: entry.noFollow ?? false,
        })),
      };
      serverStore = merged;
      return merged;
    }
    return seedStore();
  } catch {
    return seedStore();
  }
}

export function getGlobalSeo(): GlobalSeoSettings {
  return loadSeoStore().global;
}

/** Hydration: apply the server's SEO store into the local cache (no re-push). */
export function persistServerSeo(store: SeoStore): void {
  serverStore = store;
  persist(store);
}

/**
 * Local write first, then the server — and the local write is UNDONE when
 * the server refuses.
 *
 * Without this a rejected save stayed in localStorage, and nothing put it
 * right: `ensureSeoHydrated` short-circuits once the gate has settled, so the
 * poisoned copy survived the session and a remount adopted it as the SAVED
 * one — the screen presenting a value the server had rejected. Worse here
 * than elsewhere, because `upsertSeoRouteForPath` re-sends the whole store
 * automatically whenever a CMS page is published, so the rejected copy would
 * be pushed again by an unrelated action.
 *
 * The rollback restores ONLY if this write is still the one in the cache —
 * restoring unconditionally would undo a concurrent save the server had
 * accepted in between.
 */
async function persistAndSync(next: SeoStore): Promise<boolean> {
  const previous = typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
  const previousServerStore = serverStore;

  persist(next);
  serverStore = next;
  const accepted = await replaceSeoRequest(next);

  if (!accepted) {
    serverStore = previousServerStore;
    if (typeof window !== "undefined") {
      const stillOurs = localStorage.getItem(STORAGE_KEY) === JSON.stringify(next);
      if (stillOurs) {
        if (previous === null) localStorage.removeItem(STORAGE_KEY);
        else localStorage.setItem(STORAGE_KEY, previous);
        window.dispatchEvent(new Event(SEO_UPDATED_EVENT));
      }
    }
  }

  return accepted;
}

export async function saveGlobalSeo(
  global: GlobalSeoSettings
): Promise<WriteResult<GlobalSeoSettings>> {
  const store = loadSeoStore();
  const next = { ...store, global };
  const persisted = await persistAndSync(next);
  // On refusal, hand back what is actually in place — `runWrite` commits the
  // returned value as the working copy regardless of acceptance.
  return { value: persisted ? global : loadSeoStore().global, persisted };
}

export function getSeoRoutes(): SeoRouteEntry[] {
  return loadSeoStore().routes;
}

export function getRouteSeo(routeKey: string): SeoRouteEntry | null {
  return getSeoRoutes().find((entry) => entry.routeKey === routeKey) ?? null;
}

export async function updateSeoRoute(
  id: string,
  patch: Partial<Omit<SeoRouteEntry, "id" | "routeKey" | "path" | "label">>
): Promise<WriteResult<SeoRouteEntry | null>> {
  const store = loadSeoStore();
  const index = store.routes.findIndex((entry) => entry.id === id);
  if (index === -1) return { value: null, persisted: false };

  const updated: SeoRouteEntry = {
    ...store.routes[index],
    ...patch,
    updatedAt: nowIso(),
  };
  store.routes[index] = updated;
  const persisted = await persistAndSync(store);
  return {
    value: persisted ? updated : (loadSeoStore().routes[index] ?? null),
    persisted,
  };
}

/**
 * Reset through the same path, and it matters most here.
 *
 * This wiped the cache to the demo seed BEFORE asking the server and returned
 * that seed whether or not it was taken. A refused reset therefore left the
 * editor showing the seed with the shop's real SEO gone from that browser —
 * and the next CMS page publish re-sent it to the database automatically.
 */
export async function resetSeoStore(): Promise<WriteResult<SeoStore>> {
  const seeded = seedStore();
  const persisted = await persistAndSync(seeded);
  return { value: persisted ? seeded : loadSeoStore(), persisted };
}

export async function upsertSeoRouteForPath(
  path: string,
  label: string,
  patch: Partial<Omit<SeoRouteEntry, "id" | "routeKey" | "path" | "label">>
): Promise<WriteResult<SeoRouteEntry>> {
  const store = loadSeoStore();
  const routeKey = `cms-page-${path.replace(/[^\w-]+/g, "-")}`;
  const index = store.routes.findIndex((entry) => entry.path === path);

  if (index === -1) {
    const created = route(
      routeKey,
      path,
      label,
      patch.metaTitle ?? label,
      patch.metaDescription ?? store.global.defaultDescription,
      patch.metaKeywords ?? [],
      patch.noIndex ?? false,
      patch.noFollow ?? false
    );
    const merged = {
      ...created,
      ...patch,
      updatedAt: nowIso(),
    };
    store.routes.push(merged);
    // Through `persistAndSync`, like every other write in this file. Writing
    // the cache and the module-level `serverStore` by hand left a refused
    // write in both with no rollback and nothing reported — and because the SEO
    // store is pushed WHOLE, the next accepted save carried it to the server.
    return { value: merged, persisted: await persistAndSync(store) };
  }

  const updated: SeoRouteEntry = {
    ...store.routes[index],
    ...patch,
    label,
    updatedAt: nowIso(),
  };
  store.routes[index] = updated;
  return { value: updated, persisted: await persistAndSync(store) };
}
