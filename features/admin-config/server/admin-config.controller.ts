import { ok } from "@/lib/server/http/response";
import { withErrorHandler, ForbiddenError, NotFoundError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireActor } from "@/lib/server/auth/access";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./admin-config.service";
import { adminConfigSchemas } from "./admin-config.validators";
import { mayUseAdminConfig } from "./admin-config.access";
import { allowlisted } from "@/lib/server/http/allowlist";

type KeyContext = { params: Promise<{ key: string }> };

export const getAdminConfigController = withErrorHandler(async (_req: Request, ctx: KeyContext) => {
  // Never public — these blobs include payment configuration. Each key has its
  // own permission; see admin-config.access.ts.
  const actor = await requireActor();
  const { key } = await ctx.params;
  if (!mayUseAdminConfig(actor, key, "read")) throw new ForbiddenError();
  return ok(await service.getAdminConfig(key), key);
});

export const replaceAdminConfigController = withErrorHandler(async (request: Request, ctx: KeyContext) => {
  const actor = await requireActor();
  const { key } = await ctx.params;

  const schema = allowlisted(adminConfigSchemas, key);
  if (!schema) throw new NotFoundError("Unknown admin-config section");
  if (!mayUseAdminConfig(actor, key, "write")) throw new ForbiddenError();

  const value = validate(schema, await readJson(request));
  const result = await service.replaceAdminConfig(key, value, {
    ...requestContext(request),
    actorId: actor.sub,
    actorEmail: actor.email,
  });
  return ok(result, `${key} saved`);
});
