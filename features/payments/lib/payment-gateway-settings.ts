"use client";

import {
  getGatewayConfig,
  PAYMENT_GATEWAYS,
} from "@/features/payments/registry/gateways";
import {
  getCommerceSettings,
  saveCommerceSettings,
} from "@/features/settings/lib/settings-repository";
import {
  replacePaymentGatewaysRequest,
} from "@/features/admin-config/lib/admin-config-api";
import type { PaymentMethodSettings } from "@/types/settings";

/**
 * Runtime gateway state.
 *
 * Core gateways (razorpay, cod) keep their ENABLED flag in commerce settings
 * (`paymentMethods`) so the existing checkout keeps working untouched. Mode /
 * priority / credential placeholders — and everything for non-core gateways — live
 * in this dedicated store. Nothing here connects to a real gateway.
 */

const STORE_KEY = "bakery-cms-payment-gateways";
export const GATEWAYS_UPDATED_EVENT = "bakery-gateways-updated";

export type GatewayMode = "test" | "live";

export interface GatewayRuntime {
  enabled: boolean;
  mode: GatewayMode;
  priority: number;
  credentials: Record<string, string>;
}

type GatewayStore = Record<string, Partial<GatewayRuntime>>;

const CORE = new Set(["razorpay", "cod"]);

function readStore(): GatewayStore {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") as GatewayStore;
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
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
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
    mode: saved.mode ?? "test",
    priority: saved.priority ?? config?.defaultPriority ?? 99,
    credentials: saved.credentials ?? {},
  };
}

/** Whether the SERVER took it. Which gateway is on decides how customers pay. */
export async function setGatewayEnabled(id: string, enabled: boolean): Promise<boolean> {
  if (CORE.has(id)) {
    const commerce = getCommerceSettings();
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

export function setGatewayMode(id: string, mode: GatewayMode): Promise<boolean> {
  const store = readStore();
  store[id] = { ...store[id], mode };
  return writeStore(store);
}

export function setGatewayPriority(id: string, priority: number): Promise<boolean> {
  const store = readStore();
  store[id] = { ...store[id], priority };
  return writeStore(store);
}

export function saveGatewayCredentials(
  id: string,
  credentials: Record<string, string>
): Promise<boolean> {
  const store = readStore();
  store[id] = { ...store[id], credentials };
  return writeStore(store);
}

export type ConnectionStatus = "connected" | "configured" | "not_configured" | "ready";

/**
 * Non-core connection status is derived from whether the required config fields are
 * filled (placeholder — a real "connected" needs the backend). Razorpay's true
 * status comes from its own config API and is passed in by the caller.
 */
export function deriveConnectionStatus(id: string): ConnectionStatus {
  const config = getGatewayConfig(id);
  if (!config) return "not_configured";
  if (id === "cod" || config.category === "offline") return "ready";
  const creds = getGatewayRuntime(id).credentials;
  const required = config.configFields.filter((f) => f.required);
  const filled = required.every((f) => creds[f.key]?.trim());
  return required.length > 0 && filled ? "configured" : "not_configured";
}

/** All gateways with resolved runtime, sorted by priority. */
export function getAllGatewayStates() {
  return PAYMENT_GATEWAYS.map((config) => ({
    config,
    runtime: getGatewayRuntime(config.id),
    status: deriveConnectionStatus(config.id),
  })).sort((a, b) => a.runtime.priority - b.runtime.priority);
}
