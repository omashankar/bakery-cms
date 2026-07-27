import { ok } from "@/lib/server/http/response";
import { withErrorHandler, NotFoundError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./admin-config.service";
import { adminConfigSchemas } from "./admin-config.validators";

const CONFIG_ROLES = ["owner", "admin"] as const;
type KeyContext = { params: Promise<{ key: string }> };

export const getAdminConfigController = withErrorHandler(async (_req: Request, ctx: KeyContext) => {
  // Admin-only — these blobs include payment credentials; never public.
  await requireRole(...CONFIG_ROLES);
  const { key } = await ctx.params;
  return ok(await service.getAdminConfig(key), key);
});

export const replaceAdminConfigController = withErrorHandler(async (request: Request, ctx: KeyContext) => {
  const session = await requireRole(...CONFIG_ROLES);
  const { key } = await ctx.params;

  const schema = adminConfigSchemas[key as keyof typeof adminConfigSchemas];
  if (!schema) throw new NotFoundError("Unknown admin-config section");

  const value = validate(schema, await readJson(request));
  const result = await service.replaceAdminConfig(key, value, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, `${key} saved`);
});
