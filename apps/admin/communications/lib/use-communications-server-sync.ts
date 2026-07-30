"use client";

import { useEffect } from "react";

import {
  communicationsHydration,
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
    let cancelled = false;

    (async () => {
      const [email, whatsapp, settings] = await Promise.all([
        fetchEmailTemplates(),
        fetchWhatsAppTemplates(),
        fetchNotificationSettings(),
      ]);
      if (cancelled) return;
      if (email) persistServerEmailTemplates(email);
      if (whatsapp) persistServerWhatsAppTemplates(whatsapp);
      if (settings) persistServerNotificationSettings(settings);

      // Only NOW may a replace-all mutation send the local list — before this,
      // that list is whatever this browser happened to hold.
      if (email && whatsapp) communicationsHydration.markSettled();
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
