"use client";

import { useEffect } from "react";

import { fetchBanners, fetchTestimonials, fetchFaqs } from "@/features/content/lib/content-api";
import { persistServerBanners } from "@/features/content/lib/banners-repository";
import { persistServerTestimonials } from "@/features/content/lib/testimonials-repository";
import { persistServerFaqs } from "@/features/content/lib/faq-repository";

/**
 * Hydrates banners, testimonials and FAQ from the server once on mount, so the
 * storefront and admin both read the durable server collections. Reads are
 * public. After hydration the local cache matches the server, so admin
 * mutations safely dual-write replace-all.
 */
export function ContentServerSync() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [banners, testimonials, faqs] = await Promise.all([
        fetchBanners(),
        fetchTestimonials(),
        fetchFaqs(),
      ]);
      if (cancelled) return;
      if (banners) persistServerBanners(banners);
      if (testimonials) persistServerTestimonials(testimonials);
      if (faqs) persistServerFaqs(faqs);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
