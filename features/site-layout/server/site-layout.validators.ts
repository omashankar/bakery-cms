import { z } from "zod";

/** Lenient site-layout schemas — validate the shape, pass the rest through. */

const seoRouteSchema = z
  .object({
    id: z.string().min(1),
    routeKey: z.string().min(1),
    path: z.string().min(1),
    metaTitle: z.string().default(""),
    metaDescription: z.string().default(""),
  })
  .passthrough();

const seoSchema = z
  .object({
    global: z.object({ siteName: z.string().min(1) }).passthrough(),
    routes: z.array(seoRouteSchema),
  })
  .passthrough();

const headerNavSchema = z
  .object({ id: z.string().min(1), label: z.string(), href: z.string() })
  .passthrough();

const headerSchema = z
  .object({
    logoLetter: z.string().default(""),
    nav: z.array(headerNavSchema),
  })
  .passthrough();

const footerColumnSchema = z
  .object({ id: z.string().min(1), title: z.string() })
  .passthrough();

const footerSchema = z
  .object({
    columns: z.array(footerColumnSchema),
    copyrightSuffix: z.string().default(""),
  })
  .passthrough();

const appearanceSchema = z
  .object({
    primaryColor: z.string().min(1),
    accentColor: z.string().min(1),
    surfaceColor: z.string().min(1),
    borderRadius: z.number(),
  })
  .passthrough();

export const siteLayoutSchemas = {
  seo: seoSchema,
  header: headerSchema,
  footer: footerSchema,
  appearance: appearanceSchema,
} as const;
