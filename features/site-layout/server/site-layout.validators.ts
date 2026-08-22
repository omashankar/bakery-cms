import { z } from "zod";

/** Lenient site-layout schemas — validate the shape, pass the rest through. */

/**
 * The fields the admin screen and the metadata builder actually read.
 *
 * `label`, `updatedAt`, `noIndex` and `noFollow` were unconstrained. The SEO
 * table sorts on `label.localeCompare(...)`, so a restored backup missing it
 * threw on every load of that screen; the sitemap stamps `lastModified` from
 * `updatedAt`, and `new Date(undefined)` is an Invalid Date; and a missing
 * `noIndex` silently changes whether a page is offered to crawlers. Reachable
 * through backup restore, which posts a hand-editable file to this endpoint.
 */
const seoRouteSchema = z
  .object({
    id: z.string().min(1),
    routeKey: z.string().min(1),
    path: z.string().min(1),
    label: z.string().default(""),
    metaTitle: z.string().default(""),
    metaDescription: z.string().default(""),
    noIndex: z.boolean().default(false),
    noFollow: z.boolean().default(false),
    updatedAt: z.string().default(() => new Date().toISOString()),
  })
  .passthrough();

/**
 * The two GLOBAL fields with the same problem the route fields above had.
 *
 * `global` validated `siteName` and passed everything else through, so:
 *
 *  - `canonicalBaseUrl` could be any type at all, and three consumers call
 *    `.replace(/\/$/, "")` on it with no guard — `app/robots.ts`,
 *    `sitemap-generator.ts` and `seo-metadata.ts`. Stored as `null`, robots.txt
 *    and sitemap.xml both answer 500. (`email.service.ts` reads the same field
 *    with `?.trim()` and a fallback; one careful consumer and three that assume.)
 *  - `allowIndexing` could be any type, and `app/robots.ts` does
 *    `if (!global.allowIndexing)`. Stored as `null`, robots.txt serves
 *    `Disallow: /` — the whole shop withdrawn from every search engine, silently.
 *
 * Both confirmed live. Reachable the same way the route fields were: the backup
 * restore posts a hand-editable JSON file straight to this endpoint.
 *
 * `canonicalBaseUrl` is checked as a URL rather than merely a string, because
 * "your-bakery.com" without a scheme is an ordinary thing to type and produces a
 * `Sitemap: your-bakery.com/sitemap.xml` line no crawler can use — broken in a way
 * nobody sees.
 */
const seoGlobalSchema = z
  .object({
    siteName: z.string().min(1),
    canonicalBaseUrl: z
      .string()
      .trim()
      .refine(
        (value) => {
          if (!value) return true;
          try {
            return ["http:", "https:"].includes(new URL(value).protocol);
          } catch {
            return false;
          }
        },
        "Use a full address, including https://",
      )
      .default(""),
    allowIndexing: z.boolean().default(true),
  })
  .passthrough();

const seoSchema = z
  .object({
    global: seoGlobalSchema,
    routes: z.array(seoRouteSchema),
  })
  .passthrough();

/**
 * The two fields the STOREFRONT reads that nothing validated.
 *
 * `selectVisibleNavItems` filters on `item.isVisible` and sorts on
 * `sortOrder`. Neither was in the schema, so a payload without them was
 * accepted — and `undefined` is falsy, so every link vanished from the
 * customer's navbar while the admin's cache-merged view still showed them all.
 * A missing `sortOrder` makes the comparator return NaN, which is an unstable
 * sort rather than an error. Reachable through backup restore, which posts a
 * hand-editable file straight to this endpoint.
 */
const headerNavSchema = z
  .object({
    id: z.string().min(1),
    label: z.string(),
    href: z.string(),
    isVisible: z.boolean().default(true),
    sortOrder: z.number().int().default(0),
  })
  .passthrough();

const headerSchema = z
  .object({
    logoLetter: z.string().default(""),
    nav: z.array(headerNavSchema),
  })
  .passthrough();

/**
 * `links` is what the footer actually renders, and it was unvalidated.
 *
 * `landing-footer.tsx` does `column.links.map(...)` with no guard, and it
 * renders inside the storefront shell — OUTSIDE the try/catch in
 * `storefront-chrome.server.ts`. So a stored column without `links` threw
 * during render on EVERY storefront route, and the admin's own footer screen
 * died on the same value, leaving no way to correct it from the UI.
 *
 * `.default([])` rather than `.min(1)`: a column with no links is a legitimate
 * heading, and rejecting it would be inventing a rule.
 */
const footerColumnSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    links: z
      .array(
        z
          .object({ id: z.string().min(1), label: z.string(), href: z.string() })
          .passthrough(),
      )
      .default([]),
  })
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
