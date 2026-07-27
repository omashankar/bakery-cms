import { ok } from "@/lib/server/http/response";
import { withErrorHandler, NotFoundError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./communications.service";
import { templateSchemas, notificationSettingsSchema } from "./communications.validators";

const COMMS_ROLES = ["owner", "admin"] as const;
type KeyContext = { params: Promise<{ key: string }> };

export const getTemplatesController = withErrorHandler(async (_req: Request, ctx: KeyContext) => {
  // Admin-only — templates are back-office config, not storefront content.
  await requireRole(...COMMS_ROLES);
  const { key } = await ctx.params;
  return ok(await service.getTemplates(key), key);
});

export const replaceTemplatesController = withErrorHandler(async (request: Request, ctx: KeyContext) => {
  const session = await requireRole(...COMMS_ROLES);
  const { key } = await ctx.params;

  const schema = templateSchemas[key as keyof typeof templateSchemas];
  if (!schema) throw new NotFoundError("Unknown template collection");

  const items = validate(schema, await readJson(request));
  const result = await service.replaceTemplates(key, items, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, `${key} saved`);
});

export const getNotificationSettingsController = withErrorHandler(async () => {
  await requireRole(...COMMS_ROLES);
  return ok(await service.getNotificationSettings(), "notification-settings");
});

export const saveNotificationSettingsController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...COMMS_ROLES);
  const settings = validate(notificationSettingsSchema, await readJson(request));
  const result = await service.saveNotificationSettings(settings, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, "Notification settings saved");
});
