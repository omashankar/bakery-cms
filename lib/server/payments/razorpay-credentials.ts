import fs from "node:fs";
import path from "node:path";

import {
  clearGatewayCredentials,
  readGatewayCredentials,
  writeGatewayCredentials,
} from "@/features/payments/server/gateway-credentials.server";

/**
 * Server-only Razorpay credential store.
 *
 * The secret key must never reach the browser. It comes from an environment
 * variable (best for production) or from the admin panel, and only a
 * "configured" status and the public key id are ever sent to a client.
 *
 * Two things changed here, both of which had made the shop's own setup fail:
 *
 *  1. Admin-entered keys now live in MONGO, not in a JSON file on the local disk
 *     of whichever instance happened to serve the POST. That file does not exist
 *     on a second instance, after a container restart, or anywhere serverless —
 *     so the keys silently vanished and every payment failed. The file is still
 *     READ, once, so existing installs keep working and get migrated on the next
 *     save.
 *
 *  2. The WEBHOOK SECRET can now actually be saved. `getRazorpayWebhookSecret`
 *     read `webhookSecret` out of that file, and nothing in the entire codebase
 *     ever wrote it — `saveRazorpayConfig` serialised exactly `{keyId,
 *     keySecret}` and, because it rewrote the whole file, also deleted any
 *     value an operator had placed there by hand. So the webhook returned 503 to
 *     every delivery, forever, for any shop that entered its keys through the
 *     admin panel. That webhook is the only thing that rescues a payment whose
 *     customer closed the tab, which made it inert exactly when it mattered.
 */

const GATEWAY_ID = "razorpay";
const LEGACY_CONFIG_PATH = path.join(process.cwd(), ".razorpay-config.json");

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
}

/**
 * The pre-Mongo config file, read-only.
 *
 * Kept so an existing self-hosted install does not lose its keys on deploy. The
 * next save through the admin panel writes to Mongo and this stops being
 * consulted for anything Mongo has.
 */
function readLegacyFile(): Record<string, string> {
  try {
    if (!fs.existsSync(LEGACY_CONFIG_PATH)) return {};
    const parsed = JSON.parse(fs.readFileSync(LEGACY_CONFIG_PATH, "utf8"));
    return typeof parsed === "object" && parsed ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Merged per FIELD, not per source.
 *
 * An either/or fallback would let a partial Mongo record — say a webhook secret
 * saved on its own — shadow the legacy file entirely and take the API keys with
 * it, so adding a webhook secret would stop payments working. Mongo wins field
 * by field; anything it does not have falls through to the file.
 */
async function storedCredentials(): Promise<Record<string, string>> {
  const fromDb = await readGatewayCredentials(GATEWAY_ID).catch(() => ({}));
  return { ...readLegacyFile(), ...fromDb };
}

/** Environment variables win; otherwise the admin-saved values. */
export async function getRazorpayCredentials(): Promise<RazorpayCredentials | null> {
  const envId = process.env.RAZORPAY_KEY_ID;
  const envSecret = process.env.RAZORPAY_KEY_SECRET;
  if (envId && envSecret) return { keyId: envId, keySecret: envSecret };

  const stored = await storedCredentials();
  if (stored.keyId && stored.keySecret) {
    return { keyId: String(stored.keyId), keySecret: String(stored.keySecret) };
  }
  return null;
}

/**
 * The secret Razorpay signs WEBHOOKS with.
 *
 * A different secret from the API key — Razorpay generates it when the webhook
 * is created in its dashboard. Without it a delivery cannot be trusted at all,
 * so the handler refuses every one rather than acting on unsigned input.
 */
export async function getRazorpayWebhookSecret(): Promise<string | null> {
  const fromEnv = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (fromEnv) return fromEnv;

  const stored = await storedCredentials();
  const value = stored.webhookSecret;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export interface RazorpayStatus {
  configured: boolean;
  keyId: string;
  source: "env" | "admin" | null;
  /** Keys come from the environment, so the admin form is read-only. */
  envLocked: boolean;
  testMode: boolean | null;
  /** Whether the webhook can verify a delivery at all. */
  webhookConfigured: boolean;
  webhookEnvLocked: boolean;
}

/** Safe status for the admin UI — never includes a secret. */
export async function getRazorpayStatus(): Promise<RazorpayStatus> {
  const envLocked = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  const credentials = await getRazorpayCredentials();
  const webhookSecret = await getRazorpayWebhookSecret();

  return {
    configured: Boolean(credentials),
    keyId: credentials?.keyId ?? "",
    source: credentials ? (envLocked ? "env" : "admin") : null,
    envLocked,
    testMode: credentials?.keyId ? credentials.keyId.startsWith("rzp_test_") : null,
    webhookConfigured: Boolean(webhookSecret),
    webhookEnvLocked: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET?.trim()),
  };
}

/**
 * Save admin-entered Razorpay configuration.
 *
 * Every field is optional and a blank one leaves the stored value alone, so
 * rotating the key id does not silently wipe the webhook secret beside it —
 * which is exactly what the old whole-file rewrite did.
 */
export async function saveRazorpayConfig(input: {
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
}): Promise<void> {
  // Carry the legacy file's values across on the first save, so migrating does
  // not drop a secret the operator never retyped.
  const legacy = readLegacyFile();
  const existing = await readGatewayCredentials(GATEWAY_ID).catch(() => ({}));
  const carried = Object.keys(existing).length === 0 ? legacy : {};

  await writeGatewayCredentials(GATEWAY_ID, { ...carried, ...input });
  // The keys may have changed, so the cached verdict is no longer about them.
  checkCache = null;
}

/**
 * Ask Razorpay whether these keys actually work.
 *
 * `configured` only ever meant "both variables are non-empty". A `.env.local`
 * containing the literal placeholder `rzp_test_xxxxxxxxxxxxxx` therefore
 * displayed a green "Connected · Test" badge — and the first real customer would
 * have been the one to discover otherwise, at the payment step. A status that
 * cannot fail is not a status.
 *
 * `orders.all({count: 1})` is the cheapest authenticated READ: it creates
 * nothing, changes nothing, and fails with 401 on bad credentials.
 */
export interface RazorpayCheck {
  reachable: boolean;
  /** Why not, in words an operator can act on. */
  error?: string;
}

/** Short cache: this runs on page load, and the answer does not change per second. */
let checkCache: { at: number; keyId: string; result: RazorpayCheck } | null = null;
const CHECK_TTL_MS = 60_000;

export async function verifyRazorpayCredentials(): Promise<RazorpayCheck> {
  const credentials = await getRazorpayCredentials();
  if (!credentials) return { reachable: false, error: "No keys are configured." };

  const now = Date.now();
  if (checkCache && checkCache.keyId === credentials.keyId && now - checkCache.at < CHECK_TTL_MS) {
    return checkCache.result;
  }

  let result: RazorpayCheck;
  try {
    const Razorpay = (await import("razorpay")).default;
    const client = new Razorpay({ key_id: credentials.keyId, key_secret: credentials.keySecret });
    await client.orders.all({ count: 1 });
    result = { reachable: true };
  } catch (error) {
    const status = (error as { statusCode?: number })?.statusCode;
    const described =
      (error as { error?: { description?: string } })?.error?.description ??
      (error instanceof Error ? error.message : "Razorpay did not answer");

    result = {
      reachable: false,
      error:
        status === 401
          ? "Razorpay rejected these keys. Check the Key ID and Key Secret."
          : described,
    };
  }

  checkCache = { at: now, keyId: credentials.keyId, result };
  return result;
}

export async function clearRazorpayConfig(): Promise<void> {
  checkCache = null;
  await clearGatewayCredentials(GATEWAY_ID);
  try {
    if (fs.existsSync(LEGACY_CONFIG_PATH)) fs.unlinkSync(LEGACY_CONFIG_PATH);
  } catch {
    // Best effort: the Mongo record is the one that counts now.
  }
}
