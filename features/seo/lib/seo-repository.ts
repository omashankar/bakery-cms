import { safeSetItem } from "@/lib/safe-storage";
import { brandInfo } from "@/constants/landing-data";
import { DEFAULT_LABELS } from "@/config/business-labels";
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

/**
 * EMPTY, and it was a hotlinked stock photograph of a cake.
 *
 * It was the og:image on every page of every shop — a third party's picture,
 * served from a third party's CDN, presented as the shop's own in every link
 * preview and every share. Wrong for a florist, wrong for a phone shop, and a
 * dead preview the day that URL stops answering.
 *
 * The builder emits the tag only when there is a URL — `ogImage ? [...] :
 * undefined` — so a blank omits it. No image is a correct link preview; a
 * stranger's cake is not.
 */
const defaultOgImage = "";

export function seedGlobal(): GlobalSeoSettings {
  return {
    siteName: brandInfo.name,
    titleSuffix: `| ${brandInfo.name}`,
    /*
      BLANK, and it was `brandInfo.description` — "Freshly baked cakes,
      pastries and confections, made to order." That is the unconfigured
      SHOP identity, and borrowing it here made it the sentence Google prints
      under every page of a shop that may sell flowers.

      The builder omits the tag when this is blank —
      `...(global.defaultDescription.trim() ? { description } : {})` — so an
      unconfigured shop has no meta description rather than a wrong one, and
      the SEO screen is where it writes its own. No description is a gap a
      shop can close; a description about someone else’s trade is one it has
      to notice first.
    */
    defaultDescription: "",
    defaultOgImage,
    /*
      EMPTY. These were one trade's search terms on every shop's every page,
      and keywords are the field where a guess is least defensible — they say
      what the shop wants to be found for, which only the shop knows. The
      builder falls back to this list when a route has none of its own, so
      empty means "no keywords tag" rather than a wrong one.
    */
    defaultKeywords: [],
    /*
      A RESERVED HOST THAT NAMES NO TRADE. It was `www.your-bakery.example`.

      `.example` is reserved by RFC 2606 precisely so it never resolves, and
      that is the point: an unconfigured shop must not hand a crawler a real
      address it does not own. But this value reaches robots.txt and every
      canonical tag, so until the shop sets its domain it was telling crawlers
      the trade too. `www.example.com` is reserved by the same RFC and says
      nothing.
    */
    canonicalBaseUrl: "https://www.example.com",
    allowIndexing: true,
    googleSiteVerification: "",
    defaultTwitterCard: "summary_large_image",
    // Empty, not a handle. `twitter:site` attributes a page to an account; a
    // seeded one credits somebody else's brand for every page the shop
    // publishes. An absent tag is correct until the shop has an account.
    twitterSite: "",
    twitterCreator: "",
    // Emitted only once the shop supplies it. A seeded Organization block
    // asserts a name, description and URL to search engines as structured
    // fact — the one place a placeholder does the most damage.
    organizationSchemaJson: "",
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
      /*
        THE SHOP'S NAME AND NOTHING APPENDED. This was
        `${brandInfo.name} — Cakes & Pastries`, which told every shop's
        customers what it sells before the shop had said.
      */
      brandInfo.name,
      "",
      []
    ),
    route(
      "store-collections",
      routes.store.collections,
      "Collections",
      /*
        The neutral heading every shop already starts with, taken from
        `DEFAULT_LABELS` rather than retyped — a shop that renames this page
        should not have two places to change. It was "Cake Collections".
      */
      DEFAULT_LABELS.collectionsTitle,
      "",
      []
    ),


    route(
      "store-contact",
      routes.store.contact,
      "Contact",
      "Contact",
      "",
      []
    ),
    route(
      "store-faq",
      routes.store.faq,
      "FAQ",
      "FAQ",
      "",
      []
    ),

    route(
      "store-privacy",
      routes.store.privacy,
      "Privacy Policy",
      "Privacy Policy",
      "How we collect, use, and protect your information.",
      []
    ),
    route(
      "store-terms",
      routes.store.terms,
      "Terms of Service",
      "Terms of Service",
      "",
      []
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
  safeSetItem(STORAGE_KEY, JSON.stringify(store));
  safeSetItem(STORAGE_VERSION_KEY, String(SEO_STORAGE_VERSION));
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
        else safeSetItem(STORAGE_KEY, previous);
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
