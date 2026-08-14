import type { LandingFaq, LandingTestimonial } from "@/constants/landing-data";
import {
  getPublishedTestimonials,
  toLandingTestimonial,
} from "@/features/content/lib/testimonials-repository";
import { getPublishedFaqs, toLandingFaq } from "@/features/content/lib/faq-repository";
import type { FaqCategory, FaqItem, Testimonial } from "@/types/content";

export function getStorefrontTestimonials(): LandingTestimonial[] {
  return getPublishedTestimonials().map(toLandingTestimonial);
}

export function getStorefrontFaqs(category?: FaqCategory): LandingFaq[] {
  return getPublishedFaqs(category).map(toLandingFaq);
}

/**
 * Pure selectors — shared by the client getters above AND the server render, so
 * both passes agree. The server reads the raw content from MongoDB and passes it
 * down as a prop; each section derives its list from that same snapshot rather
 * than re-reading the browser store, which keeps the pages hydration-safe.
 */
/**
 * Featured reviews first, then the admin's order.
 *
 * `isFeatured` was dead. The admin's list shows a Featured badge, the overview
 * counts them on a card headed "Homepage highlights", and the form switch reads
 * "Feature this review on homepage sections" — and every storefront section
 * rendered every published testimonial in plain `sortOrder`, so ticking it did
 * nothing at all and nothing said so. A shop had no way to choose which review
 * led its homepage.
 */
/**
 * Drop everything the storefront must not show, KEEPING THE SHAPE.
 *
 * The selectors below also map to their landing shapes, which is what the
 * rendering components want — but the server pages hand the raw arrays to
 * client components, so the whole list crossed the wire in the RSC payload:
 * every draft and archived FAQ and testimonial, readable in the page source by
 * anyone who looked, including answers to questions the shop had not decided
 * to publish yet. The render filtered them; the transport did not.
 *
 * Applied on the server before the handoff. The client filters again on the
 * way to the screen, which is harmless and stays as the second line.
 */
export function publishedOnly<T extends { status: string }>(items: T[] | null | undefined): T[] {
  return (items ?? []).filter((item) => item.status === "published");
}

export function selectStorefrontTestimonials(testimonials: Testimonial[]): LandingTestimonial[] {
  return testimonials
    .filter((item) => item.status === "published")
    .sort(
      (a, b) =>
        Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured)) ||
        a.sortOrder - b.sortOrder,
    )
    .map(toLandingTestimonial);
}

export function selectStorefrontFaqs(faqs: FaqItem[], category?: FaqCategory): LandingFaq[] {
  return faqs
    .filter((item) => item.status === "published")
    .filter((item) => !category || item.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toLandingFaq);
}
