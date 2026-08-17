"use client";

import {
  getGatewayConfig,
  PAYMENT_GATEWAYS,
} from "@/features/payments/registry/gateways";
import {
  getCommerceSettings,
  readHydratedCommerce,
  saveCommerceSettings,
} from "@/features/settings/lib/settings-repository";
import {
  replacePaymentGatewaysRequest,
} from "@/features/admin-config/lib/admin-config-api";
import type { PaymentMethodSettings } from "@/types/settings";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";

/**
 * Runtime gateway state — the NON-SECRET part.
 *
 * Core gateways (razorpay, cod) keep their ENABLED flag in commerce settings
 * (`paymentMethods`) so the existing checkout keeps working untouched. Mode and
 * priority — and the enabled flag for non-core gateways — live in this store.
 *
 * Credentials deliberately do NOT. They used to: `saveGatewayCredentials` wrote
 * them here, which meant `localStorage.setItem` in plaintext plus a push into an
 * admin-config blob that a GET read back in full. Eight gateways' live secrets —
 * Stripe's `sk_live_`, PayPal's client secret, PhonePe's salt key, PayU's
 * merchant salt, CCAvenue's working key, Square's access token, Authorize.Net's
 * transaction key, Razorpay's key secret — sat on the admin's own disk, survived
 * logout, were re-pushed to every device that admin signed in from, were
 * readable by any script on the page, and were included verbatim in the plaintext
 * JSON that Settings → Backup downloads. Any one of them can move money.
 *
 * They live server-side now (`/api/payments/gateways/[id]/credentials`), and the
 * browser is only ever told WHICH fields are set.
 */

const STORE_KEY = "bakery-cms-payment-gateways";
export const GATEWAYS_UPDATED_EVENT = "bakery-gateways-updated";

/**
 * Runtime state. No `mode`, deliberately.
 *
 * There used to be a Test / Live toggle on the gateway card and its detail page.
 * Nothing outside those two components ever read the value — no payment path,
 * no API call, nothing. Pressing it changed a string in localStorage and that
 * was the whole effect.
 *
 * Worse than dead: for Razorpay it CONTRADICTED reality. The real environment is
 * decided by the key prefix (`rzp_test_` vs `rzp_live_`), which is what the
 * connection badge reports — so a shop could read "Live Mode" on one screen and
 * "Connected · Test" on the next, and neither was the thing to fix.
 */
export interface GatewayRuntime {
  enabled: boolean;
  priority: number;
}

/** What the server will say about a gateway's secrets, without revealing them. */
export interface GatewayCredentialStatus {
  gatewayId: string;
  configured: boolean;
  filledFields: string[];
  missingRequired: string[];
  updatedAt: string | null;
  publicHint: string | null;
}

type GatewayStore = Record<string, Partial<GatewayRuntime>>;

const CORE = new Set(["razorpay", "cod"]);

/**
 * Reads the local store, dropping any credentials a previous version left behind.
 *
 * Installs that ran the old code have live secrets sitting in this browser's
 * localStorage right now. Changing the write path does not remove them — so the
 * read path strips them, and the next save persists the cleaned shape. Without
 * this, "we no longer store secrets in the browser" would be true only of shops
 * that had never used the feature.
 */
function readStore(): GatewayStore {
  if (typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") as Record<
      string,
      Partial<GatewayRuntime> & { credentials?: unknown }
    >;

    let hadCredentials = false;
    const cleaned: GatewayStore = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (!entry || typeof entry !== "object") continue;
      const { credentials, ...rest } = entry;
      if (credentials && typeof credentials === "object" && Object.keys(credentials).length > 0) {
        hadCredentials = true;
      }
      cleaned[id] = rest;
    }

    if (hadCredentials) {
      localStorage.setItem(STORE_KEY, JSON.stringify(cleaned));
      console.warn(
        "[payments] Removed gateway credentials that an earlier version stored in this browser. Re-enter them in Admin → Payments; they are saved on the server now.",
      );
    }
    return cleaned;
  } catch {
    return {};
  }
}

async function writeStore(store: GatewayStore): Promise<boolean> {
  if (typeof window === "undefined") return false;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
  // writeStore is only reached via genuine admin mutations (never a seed/load
  // path), so dual-writing to the server here cannot clobber with defaults.
  const persisted = await replacePaymentGatewaysRequest(store);
  window.dispatchEvent(new Event(GATEWAYS_UPDATED_EVENT));
  return persisted;
}

/** Hydration: apply the server's gateway runtime store locally (no re-push). */
export function persistServerGateways(store: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  // Strip on the way in as well as on the way out: an install that ran the old
  // code has credentials in the SERVER blob too, and hydrating them would put
  // them straight back onto this device.
  const cleaned: Record<string, unknown> = {};
  for (const [id, entry] of Object.entries(store)) {
    if (!entry || typeof entry !== "object") continue;
    const { credentials: _dropped, ...rest } = entry as Record<string, unknown>;
    void _dropped;
    cleaned[id] = rest;
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(cleaned));
  window.dispatchEvent(new Event(GATEWAYS_UPDATED_EVENT));
}

function coreEnabled(id: string): boolean {
  const methods = getCommerceSettings().paymentMethods as PaymentMethodSettings;
  return Boolean(methods[id as keyof PaymentMethodSettings]);
}

/** Fully-resolved runtime state for a gateway (registry defaults + saved overrides). */
export function getGatewayRuntime(id: string): GatewayRuntime {
  const config = getGatewayConfig(id);
  const saved = readStore()[id] ?? {};
  return {
    enabled: CORE.has(id) ? coreEnabled(id) : saved.enabled ?? false,
    priority: saved.priority ?? config?.defaultPriority ?? 99,
  };
}

/** Whether the SERVER took it. Which gateway is on decides how customers pay. */
export async function setGatewayEnabled(id: string, enabled: boolean): Promise<boolean> {
  if (CORE.has(id)) {
    // Which payment methods are on lives INSIDE the commerce section, so this
    // one switch sends the whole of it — the delivery fee, the tax rate, the
    // checkout terms, the time slots. Read it only once the server's copy has
    // landed in the cache, or send nothing at all. See `readHydratedCommerce`.
    const commerce = await readHydratedCommerce();
    if (!commerce) return false;

    const { persisted } = await saveCommerceSettings({
      ...commerce,
      paymentMethods: { ...commerce.paymentMethods, [id]: enabled },
    });
    window.dispatchEvent(new Event(GATEWAYS_UPDATED_EVENT));
    return persisted;
  }
  const store = readStore();
  store[id] = { ...store[id], enabled };
  return writeStore(store);
}

export function setGatewayPriority(id: string, priority: number): Promise<boolean> {
  const store = readStore();
  store[id] = { ...store[id], priority };
  return writeStore(store);
}

/**
 * Send secrets to the SERVER. They are never written to this device.
 *
 * Blank fields are ignored server-side, so a form the admin only partly retyped
 * cannot wipe the rest — a secret input can never be pre-filled with its current
 * value, which is exactly why saving used to be able to erase one.
 */
export async function saveGatewayCredentials(
  id: string,
  credentials: Record<string, string>
): Promise<boolean> {
  try {
    const response = await fetch(`/api/payments/gateways/${encodeURIComponent(id)}/credentials`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(credentials),
    });
    noteAuthStatus(response.status);
    return response.ok;
  } catch {
    return false;
  }
}

/** Which fields the server holds for this gateway. Never the values. */
export async function fetchGatewayCredentialStatus(
  id: string
): Promise<GatewayCredentialStatus | null> {
  try {
    const response = await fetch(`/api/payments/gateways/${encodeURIComponent(id)}/credentials`);
    if (!response.ok) {
      noteAuthStatus(response.status);
      return null;
    }
    return (await response.json()) as GatewayCredentialStatus;
  } catch {
    return null;
  }
}

export type ConnectionStatus = "connected" | "configured" | "not_configured" | "ready";

/**
 * Connection status for a gateway.
 *
 * `configured` now means the SERVER holds every required field — it used to mean
 * this browser's localStorage did, which is a different claim and was true on one
 * device while false on the next.
 */
export function deriveConnectionStatus(
  id: string,
  status?: GatewayCredentialStatus | null
): ConnectionStatus {
  const config = getGatewayConfig(id);
  if (!config) return "not_configured";
  if (id === "cod" || config.category === "offline") return "ready";
  return status?.configured ? "configured" : "not_configured";
}

/** All gateways with resolved runtime, sorted by priority. */
export function getAllGatewayStates(
  statuses: Record<string, GatewayCredentialStatus | null> = {}
) {
  return PAYMENT_GATEWAYS.map((config) => ({
    config,
    runtime: getGatewayRuntime(config.id),
    status: deriveConnectionStatus(config.id, statuses[config.id]),
  })).sort((a, b) => a.runtime.priority - b.runtime.priority);
}
