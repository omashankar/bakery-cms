import { ok } from "@/lib/server/http/response";
import { withErrorHandler, AppError, NotFoundError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./communications.service";
import { templateSchemas, notificationSettingsSchema, templateTestSchema } from "./communications.validators";

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

/**
 * Sends a real test of one email template to the signed-in admin.
 *
 * The dialog behind this awaited a 900ms timer and toasted "Test email queued
 * (demo)" — while a working transport, a real SMTP test endpoint and the
 * template itself all already existed. An admin could word a template, "test"
 * it, be told it worked, and discover on the next real order that it did not.
 *
 * The recipient is the caller's own session address and is NOT read from the
 * body. The dialog offered a free-text recipient box, and honouring that would
 * have turned an admin convenience into a way to send arbitrary mail from the
 * shop's domain to anyone — the same reason the SMTP test only mails the caller.
 *
 * Rendered with `getSampleDataForVariables`, so what lands in the inbox is what
 * the admin was shown in the live preview.
 */
export const sendTemplateTestController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...COMMS_ROLES);
  const { slug } = validate(templateTestSchema, await readJson(request));

  const result = await service.sendTemplateTest(slug, session.email);
  if (!result.sent) {
    throw new AppError(result.error ?? "Could not send the test email", 502);
  }

  return ok({ to: session.email }, "Test email sent");
});
