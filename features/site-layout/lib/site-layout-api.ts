/**
 * Client-side site-layout API (SEO store, header, footer). Whole-value
 * replace-all dual-write + hydrate. Best-effort — never throws. The SEED is
 * never dual-written; only admin mutations are. Reads are public.
 */
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

function putJson(path: string, body: unknown): void {
  void (async () => {
    try {
      await fetch(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // best-effort
    }
  })();
}

const url = (key: string) => `/api/site-layout/${key}`;

export const fetchSeoStore = () => getJson<SeoStore>(url("seo"));
export const replaceSeoRequest = (store: SeoStore) => putJson(url("seo"), store);

export const fetchHeaderSettings = () => getJson<HeaderSettings>(url("header"));
export const replaceHeaderRequest = (settings: HeaderSettings) => putJson(url("header"), settings);

export const fetchFooterSettings = () => getJson<FooterSettings>(url("footer"));
export const replaceFooterRequest = (settings: FooterSettings) => putJson(url("footer"), settings);

export const fetchAppearanceSettings = () => getJson<AppearanceSettings>(url("appearance"));
export const replaceAppearanceRequest = (settings: AppearanceSettings) =>
  putJson(url("appearance"), settings);
