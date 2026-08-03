import { ok } from "@/lib/server/http/response";
import { withErrorHandler, AppError, NotFoundError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext, writeAuditLog } from "@/lib/server/audit/audit-log";

import * as service from "./communications.service";
import * as whatsapp from "./whatsapp.service";
import {
  readWhatsAppConnectionStatus,
  saveWhatsAppConnection,
} from "./whatsapp-credentials.server";
import { verifyWhatsAppConnection } from "./whatsapp-client.server";
import {
  templateSchemas,
  notificationSettingsSchema,
  templateTestSchema,
  whatsappConnectionSchema,
} from "./communications.validators";

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

  const parsed = validate(schema, await readJson(request));
  // Either shape: a bare array from an older client, or the newer
  // `{ items, knownIds }` that lets the server delete only what this admin
  // actually removed rather than everything it did not send.
  const items = Array.isArray(parsed) ? parsed : parsed.items;
  const knownIds = Array.isArray(parsed) ? undefined : parsed.knownIds;

  const result = await service.replaceTemplates(
    key,
    items,
    {
      ...requestContext(request),
      actorId: session.sub,
      actorEmail: session.email,
    },
    knownIds,
  );
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

/**
 * The WhatsApp connection, as a STATUS — which fields are set, never the token.
 *
 * Same rule the payment gateways follow. A live WhatsApp token can message any
 * customer who has ever contacted the business, from the shop's verified
 * number; there is no reason for it to travel back to a browser, and every
 * reason not to.
 */
export const getWhatsAppConnectionController = withErrorHandler(async () => {
  await requireRole(...COMMS_ROLES);
  return ok(await readWhatsAppConnectionStatus(), "WhatsApp connection");
});

export const saveWhatsAppConnectionController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...COMMS_ROLES);
  const input = validate(whatsappConnectionSchema, await readJson(request));

  const status = await saveWhatsAppConnection(input);
  await writeAuditLog({
    action: "communications.whatsapp.connection.update",
    actorId: session.sub,
    actorEmail: session.email,
    target: { type: "communications", id: "whatsapp-connection" },
    // The token is never logged, not even its length — an audit trail is read
    // by more people than the settings page is.
    metadata: {
      phoneNumberId: status.phoneNumberId,
      businessAccountId: status.businessAccountId,
      enabled: status.enabled,
      tokenSet: status.tokenSet,
    },
    ...requestContext(request),
  });

  return ok(status, "WhatsApp connection saved");
});

/**
 * Asks Meta who these credentials belong to.
 *
 * A real round trip, not a shape check on the saved fields. The SMTP page
 * shipped for months with a "test" that inspected the config and reported
 * success, which is worse than no button: an admin with a typo'd credential was
 * told it was fine and found out on a customer's order.
 */
export const verifyWhatsAppController = withErrorHandler(async () => {
  await requireRole(...COMMS_ROLES);

  const result = await verifyWhatsAppConnection();
  if (!result.ok) throw new AppError(result.error, 502);

  return ok(result.account, "WhatsApp connection verified");
});

/** Pulls Meta's approval statuses onto the local templates. */
export const syncWhatsAppTemplatesController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...COMMS_ROLES);

  const result = await whatsapp.syncMetaApprovals({
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  if (!result.ok) throw new AppError(result.error, 502);

  return ok(result.summary, "Synced with Meta");
});

/**
 * Sends a real WhatsApp test of one stored template.
 *
 * The recipient is the shop's own contact number, decided server-side. The
 * dialog behind this offered a free-text phone box; honouring it would let any
 * admin send WhatsApp messages from the shop's verified business number to any
 * number at all, which is the same reason the email test only mails the caller.
 */
export const sendWhatsAppTestController = withErrorHandler(async (request: Request) => {
  await requireRole(...COMMS_ROLES);
  const { slug } = validate(templateTestSchema, await readJson(request));

  const result = await whatsapp.sendWhatsAppTest(slug);
  if (!result.sent) {
    throw new AppError(result.error ?? "Could not send the test message", 502);
  }

  return ok({ to: result.to }, "Test WhatsApp sent");
});
