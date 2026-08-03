import { z } from "zod";

/** Lenient template schemas — validate identifying fields, pass the rest. */

const emailTemplateSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().min(1),
    name: z.string().min(1),
    subject: z.string().default(""),
    body: z.string().default(""),
  })
  .passthrough();

const whatsappTemplateSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().min(1),
    name: z.string().min(1),
    body: z.string().default(""),
    /**
     * The Meta binding. Validated rather than passed through, because these
     * three decide what a customer actually receives: the name selects the
     * approved wording, and the ORDER of `metaParameters` decides which value
     * lands in which sentence.
     *
     * `approval` is deliberately absent — it is written only by the sync that
     * asks Meta, never by a client. A caller that could post "approved" could
     * make the shop believe wording had been reviewed when it had not.
     */
    metaName: z.string().trim().max(512).optional(),
    metaLanguage: z.string().trim().max(16).optional(),
    metaParameters: z.array(z.string().trim().min(1)).max(20).optional(),
  })
  .passthrough();

/**
 * A save may send the bare array (an older client) or `{ items, knownIds }`.
 *
 * `knownIds` is the ids the caller BELIEVED existed before its edit. A
 * replace-all otherwise asserts "these are all the templates there are", so a
 * save from a tab opened an hour ago deleted every template another admin had
 * added since — both saves reporting success. Delivery zones send the same
 * thing for the same reason.
 */
const withKnownIds = <T extends z.ZodTypeAny>(item: T) =>
  z.union([
    z.array(item),
    z.object({ items: z.array(item), knownIds: z.array(z.string()) }),
  ]);

export const templateSchemas = {
  "email-templates": withKnownIds(emailTemplateSchema),
  "whatsapp-templates": withKnownIds(whatsappTemplateSchema),
} as const;

export const notificationSettingsSchema = z.object({
  orderAlerts: z.boolean(),
  paymentAlerts: z.boolean(),
  stockAlerts: z.boolean(),
  inquiryAlerts: z.boolean(),
});

/** The template to test-send. The recipient is never taken from the caller. */
export const templateTestSchema = z.object({
  slug: z.string().trim().min(1),
});

/**
 * The WhatsApp connection an admin saves.
 *
 * `accessToken` may be empty and that is not an oversight: the form never
 * receives the stored token back, so it posts a blank field whenever the admin
 * did not retype one. `saveWhatsAppConnection` reads blank as "keep the stored
 * token" — requiring it here would wipe a working token every time somebody
 * toggled `enabled`.
 */
export const whatsappConnectionSchema = z.object({
  phoneNumberId: z.string().trim().max(64).default(""),
  businessAccountId: z.string().trim().max(64).default(""),
  accessToken: z.string().trim().max(1024).default(""),
  enabled: z.boolean().default(false),
});
