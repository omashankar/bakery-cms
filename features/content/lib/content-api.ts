/**
 * Client-side content API (banners, testimonials, FAQ). Whole-collection
 * replace-all dual-write + hydrate. Never throws; every write reports whether the server took it. The SEED is
 * never dual-written; only admin mutations are.
 */
import type { Banner } from "@/types/media";
import type { Testimonial, FaqItem } from "@/types/content";

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

export const fetchBanners = () => getJson<Banner[]>("/api/content/banners");
export const replaceBannersRequest = (items: Banner[]) => putJson("/api/content/banners", items);

export const fetchTestimonials = () => getJson<Testimonial[]>("/api/content/testimonials");
export const replaceTestimonialsRequest = (items: Testimonial[]) =>
  putJson("/api/content/testimonials", items);

export const fetchFaqs = () => getJson<FaqItem[]>("/api/content/faq");
export const replaceFaqsRequest = (items: FaqItem[]) => putJson("/api/content/faq", items);
