/**
 * Client-side content API (banners, testimonials, FAQ). Whole-collection
 * replace-all dual-write + hydrate. Best-effort — never throws. The SEED is
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

export const fetchBanners = () => getJson<Banner[]>("/api/content/banners");
export const replaceBannersRequest = (items: Banner[]) => putJson("/api/content/banners", items);

export const fetchTestimonials = () => getJson<Testimonial[]>("/api/content/testimonials");
export const replaceTestimonialsRequest = (items: Testimonial[]) =>
  putJson("/api/content/testimonials", items);

export const fetchFaqs = () => getJson<FaqItem[]>("/api/content/faq");
export const replaceFaqsRequest = (items: FaqItem[]) => putJson("/api/content/faq", items);
