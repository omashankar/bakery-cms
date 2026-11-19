import { getPageForStorefront } from "@/features/content/data/pages.server";
import { storefrontPageFrom } from "@/features/content/lib/storefront-page";
import { NotFoundError, withErrorHandler } from "@/lib/server/http/errors";
import { ok } from "@/lib/server/http/response";

interface SlugContext {
  params: Promise<{ slug: string }>;
}

/**
 * One PUBLISHED CMS page (Privacy Policy, Terms, Shipping…) for the phone app.
 *
 * Public on purpose, and safe to be: it answers exactly what `/store/pages/[slug]`
 * shows any visitor, and nothing else. `/api/pages` stays admin-only because it
 * returns drafts, schedules and SEO.
 *
 * NO PREVIEW. The website lets `?preview=1` through only for a signed-in admin
 * holding `pages.view`; this route has no such session to check, so it never
 * asks for a draft. A draft and an unknown slug answer the same 404, as they do
 * on the website ("Unpublished and unknown slugs are indistinguishable").
 */
export const GET = withErrorHandler(async (_request: Request, ctx: SlugContext) => {
  const { slug } = await ctx.params;
  const page = await getPageForStorefront(slug);
  if (!page) throw new NotFoundError("Page not found");
  return ok(storefrontPageFrom(page), "Storefront page");
});
