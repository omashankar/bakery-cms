import "server-only";

import type { Actor } from "@/lib/server/auth/access";
import type { EmailTemplateRecord, WhatsAppTemplateRecord } from "@/types/communication";
import type { NotificationSettings } from "@/types/notification";

import { getNotificationSettings, getTemplates } from "./communications.service";
import { getNotificationState } from "./notification-state.service";

/**
 * The four reads `ensureCommunicationsHydrated` makes, as the four GETs answer
 * this admin: both template collections, the notification settings, and THIS
 * admin's read/dismissed state. A screen that waits on that hydration gets all
 * four, or it would still wait on whichever was left out.
 *
 * Call inside `whenStaff` or `whenAllowed`, which have already checked the session.
 */
/**
 * The templates are shop configuration (settings.view); the notification
 * settings and this member's own read/dismissed state are what the bell needs
 * on every screen, so every member gets those.
 */
export async function readCommunicationsForAdmin(actor: Actor) {
  const templates = actor.permissions.has("settings.view");
  const [email, whatsapp, settings, state] = await Promise.all([
    templates ? getTemplates("email-templates") : Promise.resolve(null),
    templates ? getTemplates("whatsapp-templates") : Promise.resolve(null),
    getNotificationSettings(),
    getNotificationState(actor.sub),
  ]);
  return {
    // Null, not [], for a member who may not read them: an empty list would be
    // taken for the shop's real (empty) collection and settle the cache on it.
    email: email as EmailTemplateRecord[] | null,
    whatsapp: whatsapp as WhatsAppTemplateRecord[] | null,
    settings: settings as NotificationSettings,
    state: { read: state.read, dismissed: state.dismissed },
  };
}
