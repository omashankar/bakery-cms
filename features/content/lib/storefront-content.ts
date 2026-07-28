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
export function selectStorefrontTestimonials(testimonials: Testimonial[]): LandingTestimonial[] {
  return testimonials
    .filter((item) => item.status === "published")
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toLandingTestimonial);
}

export function selectStorefrontFaqs(faqs: FaqItem[], category?: FaqCategory): LandingFaq[] {
  return faqs
    .filter((item) => item.status === "published")
    .filter((item) => !category || item.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(toLandingFaq);
}
