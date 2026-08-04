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

/**
 * A colour has to be a colour.
 *
 * `z.string().min(1)` accepted "red", "", or a whole CSS declaration, and
 * `applyAppearanceSettingsTo` bails on the WHOLE palette when one field is
 * unusable — so a single bad value silences all twenty-eight tokens and the
 * shop silently reverts to the stylesheet defaults with nothing on screen
 * to say why.
 *
 * The admin UI already validates; this is the path that does not go through
 * it. `backup-repository.ts` JSON-parses an uploaded file straight into this
 * endpoint, so the file an admin restores from is the real input here.
 */
const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a hex colour such as #6f4e37");

const appearanceSchema = z
  .object({
    primaryColor: hexColor,
    accentColor: hexColor,
    surfaceColor: hexColor,
    // The editor offers exactly these two; anything else is not a radius
    // this design system has tokens for.
    borderRadius: z.union([z.literal(12), z.literal(16)]),
  })
  .passthrough();

export const siteLayoutSchemas = {
  seo: seoSchema,
  header: headerSchema,
  footer: footerSchema,
  appearance: appearanceSchema,
} as const;
