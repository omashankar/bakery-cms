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

export function getAdminConfig(key: string) {
  return storeFor(key).read();
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
