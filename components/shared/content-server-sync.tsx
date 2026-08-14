"use client";

import { useEffect } from "react";

import {
  bannersLoaded,
  bannersWritable,
  faqsLoaded,
  faqsWritable,
  fetchBanners,
  fetchFaqs,
  fetchTestimonials,
  settleFromRead,
  testimonialsLoaded,
  testimonialsWritable,
} from "@/features/content/lib/content-api";
import { persistServerBanners } from "@/features/content/lib/banners-repository";
import { persistServerTestimonials } from "@/features/content/lib/testimonials-repository";
import { persistServerFaqs } from "@/features/content/lib/faq-repository";

/**
 * Hydrates banners, testimonials and FAQ from the server once on mount, so the
 * storefront and admin both read the durable server collections.
 *
 * The read is public, and that is the whole difficulty: an anonymous caller
 * gets only the rows a visitor may see. This component used to cache that
 * subset and then declare the cache trustworthy for writing — and because it
 * mounts from `app-providers`, which wraps /login, the admin who signed in
 * through the form did exactly that. Signing in is a soft navigation, so this
 * `[]`-dep effect never ran again and the subset stood for the whole session.
 * Every mutation here is a replace-all, so the first banner they edited PUT a
 * list with the shop's switched-off, scheduled and expired banners missing, and
 * the server deleted them. Same for unpublished FAQs and unapproved
 * testimonials. The toast was green.
 *
 * So each read settles two different claims: the cache is LOADED (safe to
 * render — a visitor's subset is what a visitor should see), and separately,
 * only when the server says the answer was complete, that it is WRITABLE.
 * `ensureBannersWritable` and its siblings re-read on demand for the admin that
 * arrived by soft navigation.
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

      // Settled per collection: one failed read used to block saves to the
      // other two for the rest of the session.
      const bannerItems = settleFromRead(banners, {
        loaded: bannersLoaded,
        writable: bannersWritable,
      });
      if (bannerItems) persistServerBanners(bannerItems);

      const testimonialItems = settleFromRead(testimonials, {
        loaded: testimonialsLoaded,
        writable: testimonialsWritable,
      });
      if (testimonialItems) persistServerTestimonials(testimonialItems);

      const faqItems = settleFromRead(faqs, { loaded: faqsLoaded, writable: faqsWritable });
      if (faqItems) persistServerFaqs(faqItems);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
