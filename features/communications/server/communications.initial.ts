import "server-only";

import { getSession } from "@/lib/server/auth/dal";
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
 * Call inside `whenAdmin`, which has already checked the session.
 */
export async function readCommunicationsForAdmin() {
  const session = await getSession();
  if (!session) throw new Error("No admin session");
  const [email, whatsapp, settings, state] = await Promise.all([
    getTemplates("email-templates"),
    getTemplates("whatsapp-templates"),
    getNotificationSettings(),
    getNotificationState(session.sub),
  ]);
  return {
    email: email as EmailTemplateRecord[],
    whatsapp: whatsapp as WhatsAppTemplateRecord[],
    settings: settings as NotificationSettings,
    state: { read: state.read, dismissed: state.dismissed },
  };
}
