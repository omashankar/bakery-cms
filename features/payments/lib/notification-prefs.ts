"use client";

import {
  PAYMENT_NOTIFICATION_TEMPLATES,
  type NotifChannel,
} from "@/features/payments/registry/notification-templates";

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

function write(store: PrefStore) {
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

export function setNotificationEnabled(id: string, enabled: boolean) {
  const store = read();
  store[id] = { ...getNotificationPref(id), enabled };
  write(store);
}

export function toggleNotificationChannel(id: string, channel: NotifChannel) {
  const current = getNotificationPref(id);
  const channels = current.channels.includes(channel)
    ? current.channels.filter((c) => c !== channel)
    : [...current.channels, channel];
  const store = read();
  store[id] = { ...current, channels };
  write(store);
}
