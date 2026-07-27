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

export async function replaceTemplates(
  key: string,
  items: unknown[],
  ctx: { ip: string; userAgent: string; actorId?: string | null; actorEmail?: string },
) {
  const store = templateStoreFor(key);
  await store.write(items as never);
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
