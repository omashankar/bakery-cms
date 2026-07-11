import type { LandingFaq, LandingTestimonial } from "@/constants/landing-data";
import {
  getPublishedTestimonials,
  toLandingTestimonial,
} from "@/features/admin/testimonials";
import { getPublishedFaqs, toLandingFaq } from "@/features/admin/faq";
import type { FaqCategory } from "@/types/content";

export function getStorefrontTestimonials(): LandingTestimonial[] {
  return getPublishedTestimonials().map(toLandingTestimonial);
}

export function getStorefrontFaqs(category?: FaqCategory): LandingFaq[] {
  return getPublishedFaqs(category).map(toLandingFaq);
}
