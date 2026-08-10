import { getAdminConfig } from "@/features/admin-config/server/admin-config.service";
import type { NotifChannel } from "@/features/payments/registry/notification-templates";

/**
 * Whether a payment notification is switched on, read where the sending happens.
 *
 * The Payment Notifications screen has always stored these preferences — to
 * localStorage, then to Mongo — and nothing ever read them. Its own module said
 * so ("frontend placeholder. The backend will read these later") while the page
 * itself told the admin it was choosing "which payment events notify customers
 * and your team, and how". So an admin who switched OFF the payment-success mail
 * because customers complained about volume got a green "Notification disabled"
 * toast, and the very next order sent it again.
 *
 * Defaults to ON for anything the admin has not touched, which is what the
 * screen shows, so wiring this changes nothing for a shop that never used it.
 *
 * Deliberately never throws: a preferences read failing must not stop an order
 * confirmation going out. Silence is the worse failure of the two.
 */
interface StoredPref {
  enabled?: boolean;
  channels?: NotifChannel[];
}

export async function isNotificationEnabled(
  id: string,
  channel: NotifChannel,
): Promise<boolean> {
  try {
    const store = (await getAdminConfig("payment-notif-prefs")) as Record<
      string,
      StoredPref | undefined
    >;
    const pref = store?.[id];
    if (!pref) return true;
    if (pref.enabled === false) return false;
    // `channels` is only a restriction once the admin has set one.
    if (Array.isArray(pref.channels) && !pref.channels.includes(channel)) return false;
    return true;
  } catch {
    return true;
  }
}
