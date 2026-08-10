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
  // Public — the storefront renders header/footer and reads SEO defaults.
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
