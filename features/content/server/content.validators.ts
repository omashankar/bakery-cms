import { z } from "zod";

/** Lenient per-key array schemas — validate the identifying fields, pass the rest. */

const bannerSchema = z
  .object({ id: z.string().min(1), title: z.string(), image: z.string().default("") })
  .passthrough();

const testimonialSchema = z
  .object({ id: z.string().min(1), name: z.string().min(1), content: z.string().default("") })
  .passthrough();

const faqSchema = z
  .object({ id: z.string().min(1), question: z.string().min(1), answer: z.string().default("") })
  .passthrough();

export const contentSchemas = {
  banners: z.array(bannerSchema),
  testimonials: z.array(testimonialSchema),
  faq: z.array(faqSchema),
} as const;
