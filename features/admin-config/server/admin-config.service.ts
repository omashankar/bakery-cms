import { createMongoStore } from "@/lib/server/db/cms-store";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";

/**
 * Admin-only singleton config blobs that were client-only localStorage stores:
 * admin profile, payment-gateway runtime (mode/priority/credentials), payment
 * notification preferences, and injected custom CSS/JS. Each is stored whole in
 * the MongoDB-backed cms-store. Reads AND writes are admin-only (some hold
 * credentials), so — unlike site-layout — these never have a public GET.
 */
const stores = {
  "admin-profile": createMongoStore<Record<string, unknown>>({
    key: "admin-profile",
    seed: () => ({}),
  }),
  "payment-gateways": createMongoStore<Record<string, unknown>>({
    key: "payment-gateways",
    seed: () => ({}),
  }),
  "payment-notif-prefs": createMongoStore<Record<string, unknown>>({
    key: "payment-notif-prefs",
    seed: () => ({}),
  }),
  "custom-code": createMongoStore<{ css: string; js: string }>({
    key: "custom-code",
    seed: () => ({ css: "", js: "" }),
  }),
} as const;

export type AdminConfigKey = keyof typeof stores;

export const ADMIN_CONFIG_KEYS = Object.keys(stores) as AdminConfigKey[];

function storeFor(key: string) {
  const store = stores[key as AdminConfigKey];
  if (!store) throw new NotFoundError("Unknown admin-config section");
  return store;
}

/**
 * Purge gateway secrets from the stored blob, permanently.
 *
 * Refusing to WRITE credentials only protects installs that never ran the old
 * code. Every shop that did has live secrets — Stripe's `sk_live_`, PayPal's
 * client secret, PhonePe's salt key and the rest — sitting in this document
 * right now, and this endpoint returned it verbatim to the browser on every
 * admin page load and wrote it into the JSON that Settings → Backup downloads.
 *
 * So the read strips them AND writes the cleaned document back. Stripping on
 * read alone would keep them out of responses while leaving them at rest, where
 * a database dump or a future consumer would find them again.
 */
async function purgeGatewayCredentials(value: unknown): Promise<Record<string, unknown>> {
  if (!value || typeof value !== "object") return {};

  let found = false;
  const cleaned: Record<string, unknown> = {};
  for (const [id, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const { credentials, ...rest } = entry as Record<string, unknown>;
    if (credentials && typeof credentials === "object" && Object.keys(credentials).length > 0) {
      found = true;
    }
    cleaned[id] = rest;
  }

  if (found) {
    await stores["payment-gateways"].write(cleaned as never);
    console.warn(
      "[admin-config] Removed payment gateway credentials that an earlier version stored in the config blob. Re-enter them in Admin → Payments; they are held in a server-only collection now.",
    );
  }
  return cleaned;
}

export async function getAdminConfig(key: string) {
  const value = await storeFor(key).read();
  if (key === "payment-gateways") return purgeGatewayCredentials(value);
  return value;
}

export async function replaceAdminConfig(
  key: string,
  value: unknown,
  ctx: { ip: string; userAgent: string; actorId?: string | null; actorEmail?: string },
) {
  const store = storeFor(key);
  await store.write(value as never);
  await writeAuditLog({
    action: `admin-config.${key}.replace`,
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "admin-config", id: key },
    metadata: {},
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return store.read();
}
