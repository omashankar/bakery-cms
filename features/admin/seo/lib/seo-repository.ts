import type { Metadata } from "next";
import { brandInfo } from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import type { GlobalSeoSettings, SeoRouteEntry, SeoStore } from "@/types/seo";

const STORAGE_KEY = "bakery-cms-seo";
const STORAGE_VERSION_KEY = "bakery-cms-seo-version";
const SEO_STORAGE_VERSION = 1;

function nowIso(): string {
  return new Date().toISOString();
}

const defaultOgImage =
  "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1200&h=630&fit=crop";

function seedGlobal(): GlobalSeoSettings {
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

function seedStore(): SeoStore {
  return {
    global: seedGlobal(),
    routes: seedRoutes(),
  };
}

function persist(store: SeoStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  localStorage.setItem(STORAGE_VERSION_KEY, String(SEO_STORAGE_VERSION));
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

export function saveGlobalSeo(global: GlobalSeoSettings): GlobalSeoSettings {
  const store = loadSeoStore();
  const next = { ...store, global };
  persist(next);
  serverStore = next;
  return global;
}

export function getSeoRoutes(): SeoRouteEntry[] {
  return loadSeoStore().routes;
}

export function getRouteSeo(routeKey: string): SeoRouteEntry | null {
  return getSeoRoutes().find((entry) => entry.routeKey === routeKey) ?? null;
}

export function updateSeoRoute(
  id: string,
  patch: Partial<Omit<SeoRouteEntry, "id" | "routeKey" | "path" | "label">>
): SeoRouteEntry | null {
  const store = loadSeoStore();
  const index = store.routes.findIndex((entry) => entry.id === id);
  if (index === -1) return null;

  const updated: SeoRouteEntry = {
    ...store.routes[index],
    ...patch,
    updatedAt: nowIso(),
  };
  store.routes[index] = updated;
  persist(store);
  serverStore = store;
  return updated;
}

export function resetSeoStore(): SeoStore {
  const seeded = seedStore();
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    persist(seeded);
  }
  serverStore = seeded;
  return seeded;
}

export function upsertSeoRouteForPath(
  path: string,
  label: string,
  patch: Partial<Omit<SeoRouteEntry, "id" | "routeKey" | "path" | "label">>
): SeoRouteEntry {
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
    persist(store);
    serverStore = store;
    return merged;
  }

  const updated: SeoRouteEntry = {
    ...store.routes[index],
    ...patch,
    label,
    updatedAt: nowIso(),
  };
  store.routes[index] = updated;
  persist(store);
  serverStore = store;
  return updated;
}
