import { createMongoStore } from "@/lib/server/db/cms-store";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import { seedEmailTemplates } from "@/apps/admin/communications/lib/email-templates-repository";
import { seedWhatsAppTemplates } from "@/apps/admin/communications/lib/whatsapp-templates-repository";
import type {
  EmailTemplateRecord,
  WhatsAppTemplateRecord,
} from "@/types/communication";
import type { NotificationSettings } from "@/types/notification";
import { sendMail } from "@/lib/server/mail/send-mail";
import { toEmailHtml } from "./email.service";
import { renderTemplate } from "@/lib/template-render";
import { getSampleDataForVariables } from "@/apps/admin/communications/lib/template-sample-data";

/**
 * Communication templates (email + WhatsApp) that were client-only localStorage
 * collections. Each is stored whole in the MongoDB-backed cms-store, seeded on
 * first read from the same defaults the client shipped. Admin-only — never
 * rendered on the storefront.
 */
const templateStores = {
  "email-templates": createMongoStore<EmailTemplateRecord[]>({
    key: "email-templates",
    seed: seedEmailTemplates,
  }),
  "whatsapp-templates": createMongoStore<WhatsAppTemplateRecord[]>({
    key: "whatsapp-templates",
    seed: seedWhatsAppTemplates,
  }),
} as const;

export type TemplateKey = keyof typeof templateStores;

export const TEMPLATE_KEYS = Object.keys(templateStores) as TemplateKey[];

function templateStoreFor(key: string) {
  const store = templateStores[key as TemplateKey];
  if (!store) throw new NotFoundError("Unknown template collection");
  return store;
}

export function getTemplates(key: string) {
  return templateStoreFor(key).read();
}

/**
 * Saves a template collection, deleting only what the caller actually removed.
 *
 * `knownIds` is the ids the caller believed existed before its edit. Without
 * it a whole-collection write means "these are all the templates there are",
 * so a save from a tab opened an hour ago silently deleted every template
 * another admin had added since — and both admins were told it worked, with
 * nothing to show the missing ones had ever existed. Delivery zones solved
 * this the same way.
 *
 * A caller that sends no `knownIds` is an older client, and then nothing
 * outside its list is touched — the safe reading.
 */
export async function replaceTemplates(
  key: string,
  items: unknown[],
  ctx: { ip: string; userAgent: string; actorId?: string | null; actorEmail?: string },
  knownIds?: string[],
) {
  const store = templateStoreFor(key);

  const incoming = items as { id?: string }[];
  const keepIds = new Set(incoming.map((item) => item.id).filter(Boolean));
  const removedIds = new Set((knownIds ?? []).filter((id) => !keepIds.has(id)));

  const stored = ((await store.read()) ?? []) as { id?: string }[];
  // Anything the caller never knew about is left exactly where it is.
  const untouched = stored.filter(
    (item) => item.id && !keepIds.has(item.id) && !removedIds.has(item.id),
  );

  await store.write([...incoming, ...untouched] as never);
  await writeAuditLog({
    action: `communications.${key}.replace`,
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "communications", id: key },
    metadata: { count: items.length },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return store.read();
}

/**
 * Notification preferences (order/payment/stock/inquiry alerts) — a singleton
 * object. The notifications themselves stay derived on the client from orders,
 * inventory and inquiries; only these toggles are durable admin config.
 */
const notificationSettingsStore = createMongoStore<NotificationSettings>({
  key: "notification-settings",
  seed: () => ({
    orderAlerts: true,
    paymentAlerts: true,
    stockAlerts: true,
    inquiryAlerts: true,
  }),
});

export function getNotificationSettings() {
  return notificationSettingsStore.read();
}

export async function saveNotificationSettings(
  settings: NotificationSettings,
  ctx: { ip: string; userAgent: string; actorId?: string | null; actorEmail?: string },
) {
  await notificationSettingsStore.write(settings);
  await writeAuditLog({
    action: "communications.notification-settings.update",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "communications", id: "notification-settings" },
    metadata: { ...settings },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return notificationSettingsStore.read();
}

/**
 * Renders one stored email template with sample data and sends it.
 *
 * Deliberately reads the STORED template rather than anything the caller
 * supplies: the point of a test is to prove what a real customer would receive,
 * so testing unsaved edits would prove the wrong thing.
 */
export async function sendTemplateTest(
  slug: string,
  to: string,
): Promise<{ sent: boolean; error?: string }> {
  const templates = (await getTemplates("email-templates")) as EmailTemplateRecord[];
  const template = templates.find((item) => item.slug === slug);
  if (!template) return { sent: false, error: "That template no longer exists." };

  const sample = getSampleDataForVariables(template.variables ?? []);
  return sendMail({
    to,
    subject: `[Test] ${renderTemplate(template.subject, sample)}`,
    html: toEmailHtml(renderTemplate(template.body, sample)),
  });
}
