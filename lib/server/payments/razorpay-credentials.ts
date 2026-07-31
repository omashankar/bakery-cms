import fs from "node:fs";
import path from "node:path";

/**
 * Server-only Razorpay credential store.
 *
 * Security: the secret key must never reach the browser. It lives either in an
 * environment variable (recommended for production) or in a gitignored server
 * file written from the admin panel (convenient for self-hosted setups). Neither
 * is ever sent to the client — only a "configured" status and the public key id.
 */

const CONFIG_PATH = path.join(process.cwd(), ".razorpay-config.json");

export interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
}

function readFileConfig(): RazorpayCredentials | null {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    if (parsed?.keyId && parsed?.keySecret) {
      return { keyId: String(parsed.keyId), keySecret: String(parsed.keySecret) };
    }
    return null;
  } catch {
    return null;
  }
}

/** Environment variables win; otherwise fall back to the admin-saved file. */
export function getRazorpayCredentials(): RazorpayCredentials | null {
  const envId = process.env.RAZORPAY_KEY_ID;
  const envSecret = process.env.RAZORPAY_KEY_SECRET;
  if (envId && envSecret) return { keyId: envId, keySecret: envSecret };
  return readFileConfig();
}

/**
 * The secret Razorpay signs WEBHOOKS with.
 *
 * A different secret from the API key — set in the Razorpay dashboard when the
 * webhook is created. Without it a webhook cannot be trusted at all, so the
 * handler refuses every delivery rather than acting on unsigned input.
 */
export function getRazorpayWebhookSecret(): string | null {
  const fromEnv = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (fromEnv) return fromEnv;

  try {
    if (!fs.existsSync(CONFIG_PATH)) return null;
    const parsed = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    const stored = parsed?.webhookSecret;
    return typeof stored === "string" && stored.trim() ? stored.trim() : null;
  } catch {
    return null;
  }
}

/** Safe status for the admin UI — never includes the secret. */
export function getRazorpayStatus() {
  const fromEnv = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  const creds = getRazorpayCredentials();
  return {
    configured: Boolean(creds),
    keyId: creds?.keyId ?? "",
    source: creds ? (fromEnv ? ("env" as const) : ("admin" as const)) : null,
    envLocked: fromEnv, // when keys come from env, the admin form is read-only
    testMode: creds?.keyId ? creds.keyId.startsWith("rzp_test_") : null,
  };
}

export function saveRazorpayConfig(keyId: string, keySecret: string) {
  fs.writeFileSync(
    CONFIG_PATH,
    JSON.stringify({ keyId: keyId.trim(), keySecret: keySecret.trim() }, null, 2),
    "utf8"
  );
}

export function clearRazorpayConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
  } catch {
    // ignore
  }
}
