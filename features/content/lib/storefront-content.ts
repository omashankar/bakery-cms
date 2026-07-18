import type { LandingFaq, LandingTestimonial } from "@/constants/landing-data";
import {
  getPublishedTestimonials,
  toLandingTestimonial,
} from "@/features/content/lib/testimonials-repository";
import { getPublishedFaqs, toLandingFaq } from "@/features/content/lib/faq-repository";
import type { FaqCategory } from "@/types/content";

export function getStorefrontTestimonials(): LandingTestimonial[] {
  return getPublishedTestimonials().map(toLandingTestimonial);
}

export function getStorefrontFaqs(category?: FaqCategory): LandingFaq[] {
  return getPublishedFaqs(category).map(toLandingFaq);
}
