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

export const templateSchemas = {
  "email-templates": z.array(emailTemplateSchema),
  "whatsapp-templates": z.array(whatsappTemplateSchema),
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
