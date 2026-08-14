"use client";

import {
  PAYMENT_NOTIFICATION_TEMPLATES,
  type NotifChannel,
} from "@/features/payments/registry/notification-templates";
import {
  replacePaymentNotifPrefsRequest,
} from "@/features/admin-config/lib/admin-config-api";

/**
 * Per-notification delivery preferences (frontend placeholder). The backend will
 * read these later to decide what to actually send.
 */

const KEY = "bakery-cms-payment-notif-prefs";
export const NOTIF_PREFS_UPDATED_EVENT = "bakery-notif-prefs-updated";

interface Pref {
  enabled: boolean;
  channels: NotifChannel[];
}
type PrefStore = Record<string, Pref>;

function read(): PrefStore {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as PrefStore;
  } catch {
    return {};
  }
}

async function write(store: PrefStore): Promise<boolean> {
  if (typeof window === "undefined") return false;

  const previous = localStorage.getItem(KEY);
  localStorage.setItem(KEY, JSON.stringify(store));
  // write() is only reached via genuine admin toggles (no seed/load path), so
  // dual-writing to the server here cannot clobber with defaults.
  const persisted = await replacePaymentNotifPrefsRequest(store);

  /**
   * Undo a refused toggle.
   *
   * This is a whole-blob replace, so a refusal left in the cache is carried to
   * the server by the next accepted toggle — a preference the admin was told
   * had not saved, going live because they later changed a different one.
   * Only if the cache still holds our write: restoring unconditionally would
   * undo a concurrent toggle the server HAD accepted.
   */
  if (!persisted) {
    const stillOurs = localStorage.getItem(KEY) === JSON.stringify(store);
    if (stillOurs) {
      if (previous === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, previous);
    }
  }

  window.dispatchEvent(new Event(NOTIF_PREFS_UPDATED_EVENT));
  return persisted;
}

/** Hydration: apply the server's notification prefs locally (no re-push). */
export function persistServerNotifPrefs(store: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(store));
  window.dispatchEvent(new Event(NOTIF_PREFS_UPDATED_EVENT));
}

export function getNotificationPref(id: string): Pref {
  const template = PAYMENT_NOTIFICATION_TEMPLATES.find((t) => t.id === id);
  const saved = read()[id];
  return {
    enabled: saved?.enabled ?? true,
    channels: saved?.channels ?? template?.channels ?? ["in_app"],
  };
}

export function setNotificationEnabled(id: string, enabled: boolean): Promise<boolean> {
  const store = read();
  store[id] = { ...getNotificationPref(id), enabled };
  return write(store);
}

export function toggleNotificationChannel(
  id: string,
  channel: NotifChannel
): Promise<boolean> {
  const current = getNotificationPref(id);
  const channels = current.channels.includes(channel)
    ? current.channels.filter((c) => c !== channel)
    : [...current.channels, channel];
  const store = read();
  store[id] = { ...current, channels };
  return write(store);
}
