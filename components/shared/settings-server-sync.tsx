"use client";

import { useEffect } from "react";

import {
  fetchFullSettings,
  fetchPublicSettings,
} from "@/features/settings/lib/settings-api";
import { loadSettings, saveSettings } from "@/features/settings/lib/settings-repository";
import { mergeAppSettings } from "@/features/settings/lib/settings-utils";

/**
 * Hydrates local settings from the server once on mount, then persists them so
 * the rest of the app (business labels, module gating, commerce config) reflects
 * the durable server state instead of a stale per-browser copy.
 *
 * Admin sessions get the full settings; everyone else falls back to the public
 * subset. Server values are deep-merged OVER the current local ones, so any
 * section the server omits keeps its existing value. `saveSettings` fires the
 * SETTINGS_UPDATED_EVENT that live consumers already listen to.
 */
export function SettingsServerSync() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const server = (await fetchFullSettings()) ?? (await fetchPublicSettings());
      if (!server || cancelled) return;

      const current = loadSettings();
      const merged = mergeAppSettings({
        ...current,
        general: { ...current.general, ...(server.general ?? {}) },
        contact: { ...current.contact, ...(server.contact ?? {}) },
        social: server.social ?? current.social,
        security: { ...current.security, ...(server.security ?? {}) },
        smtp: { ...current.smtp, ...(server.smtp ?? {}) },
        analytics: { ...current.analytics, ...(server.analytics ?? {}) },
        maintenance: { ...current.maintenance, ...(server.maintenance ?? {}) },
        commerce: {
          ...current.commerce,
          ...(server.commerce ?? {}),
          paymentMethods: {
            ...current.commerce.paymentMethods,
            ...(server.commerce?.paymentMethods ?? {}),
          },
        },
        modules: { ...current.modules, ...(server.modules ?? {}) },
        // Activity is a client-only convenience log; the server uses audit_logs.
        activity: current.activity,
      });

      saveSettings(merged);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
