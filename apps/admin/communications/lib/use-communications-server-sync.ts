"use client";

import { useEffect } from "react";

import {
  emailTemplatesHydration,
  whatsappTemplatesHydration,
  notificationSettingsHydration,
  fetchEmailTemplates,
  fetchWhatsAppTemplates,
  fetchNotificationSettings,
} from "./communications-api";
import { persistServerEmailTemplates } from "./email-templates-repository";
import { persistServerWhatsAppTemplates } from "./whatsapp-templates-repository";
import { persistServerNotificationSettings } from "@/apps/admin/commerce/lib/notifications-repository";

/**
 * Hydrates email + WhatsApp templates and notification settings from the server
 * once on mount, so the admin reads the durable server collections regardless
 * of device. These endpoints are admin-guarded; the hook runs inside the admin
 * shell where the session cookie is present. After hydration the local cache
 * matches the server, so admin mutations safely dual-write replace-all.
 */
export function useCommunicationsServerSync(): void {
  useEffect(() => {
    void ensureCommunicationsHydrated();
  }, []);
}

/**
 * Reads the server's copies in, opening each gate for the collection it read.
 *
 * ONE GATE PER COLLECTION. A single gate used to cover all three and opened only
 * `if (email && whatsapp)` — so one failed WhatsApp fetch (a blip, a 500, a cold
 * start past the deadline) permanently blocked EMAIL template saves for the
 * whole session, and the admin was told "saved on this device only" about a
 * store that was perfectly reachable. A gate now answers for exactly what it
 * read, which is also what stops it vouching for a collection it never saw.
 *
 * Callable rather than mount-only, for the reason every other gate in this
 * codebase is: this runs from a `[]`-dep effect in the admin layout, and an
 * admin who signs in through the LOGIN FORM loads that layout while anonymous —
 * the reads 401, and reaching the admin afterwards is a soft navigation that
 * never remounts it. The forms call this so they can adopt the server's copy
 * before they unlock.
 */
export async function ensureCommunicationsHydrated(): Promise<{
  email: boolean;
  whatsapp: boolean;
}> {
  const [email, whatsapp, settings] = await Promise.all([
    emailTemplatesHydration.hasSettled() ? null : fetchEmailTemplates(),
    whatsappTemplatesHydration.hasSettled() ? null : fetchWhatsAppTemplates(),
    notificationSettingsHydration.hasSettled() ? null : fetchNotificationSettings(),
  ]);

  // Each write opens only its OWN gate. A `null` is a failed read, not an empty
  // collection — settling on it is what would let this browser's seed be pushed.
  if (email) {
    persistServerEmailTemplates(email);
    emailTemplatesHydration.markSettled();
  }
  if (whatsapp) {
    persistServerWhatsAppTemplates(whatsapp);
    whatsappTemplatesHydration.markSettled();
  }
  if (settings) {
    persistServerNotificationSettings(settings);
    notificationSettingsHydration.markSettled();
  }

  return {
    email: emailTemplatesHydration.hasSettled(),
    whatsapp: whatsappTemplatesHydration.hasSettled(),
  };
}
