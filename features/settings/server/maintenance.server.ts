import { cache } from "react";
import { clientIpFrom, proxyHeadersAreTrusted } from "@/lib/server/http/client-ip";
import { connection } from "next/server";
import { headers } from "next/headers";

import { getSession } from "@/lib/server/auth/dal";
import { defaultMaintenanceSettings } from "@/features/settings/lib/settings-utils";
import { normalizeIp } from "@/features/settings/lib/maintenance-access";

import { getSettings } from "./settings.service";

/**
 * Whether the storefront is closed, decided on the SERVER.
 *
 * Maintenance mode used to render a BANNER and nothing else. The switch is
 * labelled "Toggle maintenance mode for the public website", the save hint said
 * "save changes to take the storefront offline" and the admin overview said
 * "storefront is paused" — while the shop stayed fully open. A customer could
 * browse, fill a cart and complete checkout against a store the admin believed
 * they had closed, and the only sign was a yellow strip above the navbar.
 */
export interface MaintenanceState {
  /** The admin's switch. */
  isEnabled: boolean;
  message: string;
  /** True when THIS visitor may keep browsing despite the switch. */
  isExempt: boolean;
  /** Why they are exempt — drives the notice they see. */
  exemption: "none" | "admin" | "allowed-ip";
  /** The final answer: hide the storefront from this visitor. */
  isClosed: boolean;
}

/** Roles that may work on a closed shop — the same pair that may close it. */
const MAINTENANCE_ROLES = ["owner", "admin"];

/**
 * `x-forwarded-for` is written by the CLIENT unless something upstream
 * overwrites it.
 *
 * A reverse proxy appends rather than replaces (`proxy_add_x_forwarded_for`
 * yields `<whatever the client sent>, <real ip>`), and with no proxy at all the
 * header is entirely attacker-supplied. That was harmless while this derivation
 * only fed the audit log; making it an ACCESS DECISION turns it into a bypass —
 * `curl -H 'X-Forwarded-For: 127.0.0.1'` walks past a closed shop and past the
 * checkout refusal, with no credentials.
 *
 * So the header is only believed where the deployment states it is trustworthy.
 * Everywhere else the allow-list simply cannot match, and the admin is told so
 * on the settings page rather than being left to assume it works.
 */
export { proxyHeadersAreTrusted };


const OPEN: MaintenanceState = {
  isEnabled: false,
  message: "",
  isExempt: false,
  exemption: "none",
  isClosed: false,
};

async function clientIp(): Promise<string> {
  // The derivation moved to lib/server/http/client-ip.ts, unchanged, because
  // the audit context and the login throttle needed exactly this rule and had
  // their own weaker copy — the first hop, believed unconditionally.
  return clientIpFrom(await headers());
}


export const getMaintenanceState = cache(async (): Promise<MaintenanceState> => {
  // Per request, never prerendered: a storefront baked at build time would keep
  // serving after the admin closed the shop, which is the whole point of this.
  await connection();

  try {
    // One read for all three fields. `getPublicSettings` omits `allowedIps`, so
    // asking it separately meant two round trips to the same singleton on every
    // request to a closed shop.
    const settings = (await getSettings()) as unknown as {
      maintenance?: { isEnabled?: boolean; message?: string; allowedIps?: string[] };
    };
    const maintenance = settings.maintenance ?? {};

    const isEnabled = maintenance.isEnabled ?? false;
    const message = maintenance.message?.trim() || defaultMaintenanceSettings.message;
    if (!isEnabled) return { ...OPEN, message };

    // Closing the shop must not lock out the people who closed it — they need to
    // check their own work before reopening. Scoped to the roles that can
    // actually operate the switch: a Viewer or Content Editor session is not a
    // reason to serve them a shop that is closed to everyone else.
    const session = await getSession();
    if (session && MAINTENANCE_ROLES.includes(session.role)) {
      return { isEnabled, message, isExempt: true, exemption: "admin", isClosed: false };
    }

    const ip = normalizeIp(await clientIp());
    if (ip) {
      const allowed = new Set((maintenance.allowedIps ?? []).map(normalizeIp).filter(Boolean));
      if (allowed.has(ip)) {
        return { isEnabled, message, isExempt: true, exemption: "allowed-ip", isClosed: false };
      }
    }

    return { isEnabled, message, isExempt: false, exemption: "none", isClosed: true };
  } catch {
    // A settings read failing must not close a working shop. Failing OPEN is the
    // safe direction: the cost of a stray visitor during a database blip is far
    // below the cost of taking a live storefront down because Mongo hiccuped.
    return OPEN;
  }
});
