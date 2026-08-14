import { ok } from "@/lib/server/http/response";
import { withErrorHandler, NotFoundError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./site-layout.service";
import { siteLayoutSchemas } from "./site-layout.validators";
import { allowlisted } from "@/lib/server/http/allowlist";

const LAYOUT_ROLES = ["owner", "admin"] as const;
type KeyContext = { params: Promise<{ key: string }> };

export const getSiteLayoutController = withErrorHandler(async (_req: Request, ctx: KeyContext) => {
  /**
   * Owner/admin only, on the read as well as the write.
   *
   * This was public, justified as "the storefront renders header/footer and
   * reads SEO defaults". The storefront does no such thing over HTTP — it calls
   * `getSiteLayout()` in-process from `storefront-chrome.server.ts`. The only
   * callers of this URL are admin screens: the media usage panel and the SEO
   * sync. The identical route next door, /api/admin-config/[key], already
   * answered 401 to exactly this shape.
   *
   * What an anonymous `curl` got instead was the whole stored section: every
   * nav item including the ones marked `isVisible: false` — the filtering runs
   * in the renderer, not here, so a link the shop had deliberately hidden was
   * still handed out with its href — plus the complete SEO route table with the
   * `noIndex` flag on each, which is precisely the list of pages the shop does
   * not want found.
   *
   * `use-seo-server-sync` was written around this being closed: its doc comment
   * turns on an admin arriving from the login form, "so that read 401s and the
   * gate stays shut". It had stopped 401-ing.
   */
  await requireRole(...LAYOUT_ROLES);
  const { key } = await ctx.params;
  return ok(await service.getSiteLayout(key), key);
});

export const replaceSiteLayoutController = withErrorHandler(async (request: Request, ctx: KeyContext) => {
  const session = await requireRole(...LAYOUT_ROLES);
  const { key } = await ctx.params;

  const schema = allowlisted(siteLayoutSchemas, key);
  if (!schema) throw new NotFoundError("Unknown site-layout section");

  const value = validate(schema, await readJson(request));
  const result = await service.replaceSiteLayout(key, value, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, `${key} saved`);
});
