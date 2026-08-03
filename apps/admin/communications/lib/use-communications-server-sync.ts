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

/**
 * Re-reads the WhatsApp templates, whether or not the gate has already settled.
 *
 * `ensureCommunicationsHydrated` fetches at most ONCE per gate, on purpose — it
 * exists to open the gate, not to keep a page fresh. That is the wrong rule
 * after a Meta sync, which rewrites `approval` on the SERVER's rows and on
 * nothing the browser holds. Calling the once-only path there returns
 * immediately without a request, so the screen would go on showing "Not checked
 * with Meta" and a sendable count of zero directly after a sync that approved
 * everything — the page contradicting the button the admin just pressed.
 *
 * Returns null on a failed read, and then the cache is left alone: an empty
 * result from a blip must never be mistaken for "the shop has no templates".
 */
export async function refreshWhatsAppTemplates(): Promise<boolean> {
  const templates = await fetchWhatsAppTemplates();
  if (!templates) return false;

  persistServerWhatsAppTemplates(templates);
  // Settling here too: a successful read is a successful read, whichever
  // function made it, and a page that syncs before the layout's own hydration
  // lands should not stay locked.
  whatsappTemplatesHydration.markSettled();
  return true;
}
