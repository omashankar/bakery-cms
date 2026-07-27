import { ok } from "@/lib/server/http/response";
import { withErrorHandler, NotFoundError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./content.service";
import { contentSchemas } from "./content.validators";

const CONTENT_ROLES = ["owner", "admin"] as const;
type KeyContext = { params: Promise<{ key: string }> };

export const getContentController = withErrorHandler(async (_req: Request, ctx: KeyContext) => {
  // Public — the storefront renders banners/testimonials/FAQ.
  const { key } = await ctx.params;
  return ok(await service.getContent(key), key);
});

export const replaceContentController = withErrorHandler(async (request: Request, ctx: KeyContext) => {
  const session = await requireRole(...CONTENT_ROLES);
  const { key } = await ctx.params;

  const schema = contentSchemas[key as keyof typeof contentSchemas];
  if (!schema) throw new NotFoundError("Unknown content collection");

  const items = validate(schema, await readJson(request));
  const result = await service.replaceContent(key, items, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, `${key} saved`);
});
