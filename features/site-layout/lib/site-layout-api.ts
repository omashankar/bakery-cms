/**
 * Client-side site-layout API (SEO store, header, footer). Whole-value
 * replace-all dual-write + hydrate. Never throws; every write reports whether the server took it. The SEED is
 * never dual-written; only admin mutations are. Reads are public.
 */
import { createHydrationGate } from "@/lib/hydration-gate";
import type { SeoStore } from "@/types/seo";
import type { HeaderSettings, FooterSettings } from "@/types/site-layout";
import type { AppearanceSettings } from "@/types/appearance";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<T>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/**
 * Whether the SERVER accepted the write. Resolves false on a network failure OR
 * a non-2xx response; never throws.
 *
 * This used to be fire-and-forget — it launched the request into a floating
 * async IIFE and returned void, so a 401 from an expired admin token and a 500
 * were both indistinguishable from success. Every caller then reported "saved"
 * for a change that lives only in this browser and that the next hydration
 * silently reverts.
 */
async function putJson(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Settled by `SiteLayoutServerSync` — header, footer, appearance. */
export const siteLayoutHydration = createHydrationGate();

/** Settled by `useSeoServerSync`, which loads the SEO store separately. */
export const seoHydration = createHydrationGate();

async function guardedSeoPut(path: string, body: unknown): Promise<boolean> {
  if (!(await seoHydration.waitForSettled())) return false;
  return putJson(path, body);
}

/**
 * A replace-all write sends the ENTIRE local list. Waiting for hydration is what
 * stops a browser that never loaded the server's copy from overwriting it — see
 * `createHydrationGate`.
 */
async function guardedPut(path: string, body: unknown): Promise<boolean> {
  if (!(await siteLayoutHydration.waitForSettled())) return false;
  return putJson(path, body);
}

const url = (key: string) => `/api/site-layout/${key}`;

export const fetchSeoStore = () => getJson<SeoStore>(url("seo"));
export const replaceSeoRequest = (store: SeoStore) => guardedSeoPut(url("seo"), store);

export const fetchHeaderSettings = () => getJson<HeaderSettings>(url("header"));
export const replaceHeaderRequest = (settings: HeaderSettings) => guardedPut(url("header"), settings);

export const fetchFooterSettings = () => getJson<FooterSettings>(url("footer"));
export const replaceFooterRequest = (settings: FooterSettings) => guardedPut(url("footer"), settings);

export const fetchAppearanceSettings = () => getJson<AppearanceSettings>(url("appearance"));
export const replaceAppearanceRequest = (settings: AppearanceSettings) =>
  guardedPut(url("appearance"), settings);
