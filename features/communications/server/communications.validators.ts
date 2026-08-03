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
