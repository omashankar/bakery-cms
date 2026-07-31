import "server-only";

import { connectDB } from "@/lib/server/db/mongoose";
import { GatewayCredentialModel } from "@/lib/server/db/models/gateway-credential.model";
import { getGatewayConfig } from "@/features/payments/registry/gateways";

/**
 * Reading and writing gateway secrets — server side, and only server side.
 *
 * `import "server-only"` is the guard that matters here: it turns "please do not
 * import this from a client component" into a build error. The previous store
 * was a client module by design, which is how eight gateways' live secrets ended
 * up in localStorage.
 */

/** What the admin UI is allowed to know: which fields are set, never their values. */
export interface GatewayCredentialStatus {
  gatewayId: string;
  configured: boolean;
  /** Field keys that currently hold a value. */
  filledFields: string[];
  /** Field keys the registry marks required that are still empty. */
  missingRequired: string[];
  updatedAt: string | null;
  /**
   * A non-secret identifier worth echoing back so an admin can tell WHICH
   * account is connected — Razorpay's key id, Stripe's publishable key. Never a
   * secret: see `PUBLIC_FIELDS`.
   */
  publicHint: string | null;
}

/**
 * Fields that are public by design and safe to show back.
 *
 * Allow-list, not deny-list. A new gateway added to the registry with a field
 * nobody classified is treated as a secret, which is the safe direction to be
 * wrong in.
 */
const PUBLIC_FIELDS = new Set(["keyId", "publishableKey", "clientId", "merchantId", "merchantKey", "accessCode"]);

export async function readGatewayCredentials(gatewayId: string): Promise<Record<string, string>> {
  await connectDB();
  const doc = await GatewayCredentialModel.findById(gatewayId).lean();
  const stored = (doc as { credentials?: Record<string, unknown> } | null)?.credentials ?? {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(stored)) {
    if (typeof value === "string" && value) out[key] = value;
  }
  return out;
}

/**
 * Merge new values in. Absent and blank fields leave the stored value alone.
 *
 * That asymmetry is deliberate. A secret input can never be pre-filled with its
 * current value — the whole point is that the server does not send it back — so
 * a form that saves "" for the field the admin did not retype would wipe a
 * working secret every time they changed the key id beside it. Clearing is an
 * explicit action (`clearGatewayCredentials`), not a side effect of saving.
 */
export async function writeGatewayCredentials(
  gatewayId: string,
  patch: Record<string, string | undefined>,
): Promise<void> {
  await connectDB();
  const current = await readGatewayCredentials(gatewayId);
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    if (trimmed) next[key] = trimmed;
  }

  await GatewayCredentialModel.updateOne(
    { _id: gatewayId },
    { $set: { credentials: next, updatedAt: new Date().toISOString() } },
    { upsert: true },
  );
}

export async function clearGatewayCredentials(gatewayId: string): Promise<void> {
  await connectDB();
  await GatewayCredentialModel.deleteOne({ _id: gatewayId });
}

/** Safe for an API response. Derives entirely from presence, never from content. */
export async function getGatewayCredentialStatus(
  gatewayId: string,
): Promise<GatewayCredentialStatus> {
  await connectDB();
  const doc = await GatewayCredentialModel.findById(gatewayId).lean();
  const stored = (doc as { credentials?: Record<string, unknown>; updatedAt?: string } | null) ?? null;
  const credentials = stored?.credentials ?? {};

  const filledFields = Object.entries(credentials)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key]) => key);

  const config = getGatewayConfig(gatewayId);
  const required = (config?.configFields ?? []).filter((field) => field.required).map((f) => f.key);
  const missingRequired = required.filter((key) => !filledFields.includes(key));

  const publicKey = filledFields.find((key) => PUBLIC_FIELDS.has(key));
  const publicHint = publicKey ? String(credentials[publicKey]) : null;

  return {
    gatewayId,
    configured: filledFields.length > 0 && missingRequired.length === 0,
    filledFields,
    missingRequired,
    updatedAt: stored?.updatedAt ?? null,
    publicHint,
  };
}

/** Status for every gateway in the registry, for the gateway manager screen. */
export async function getAllGatewayCredentialStatuses(
  gatewayIds: string[],
): Promise<Record<string, GatewayCredentialStatus>> {
  const entries = await Promise.all(
    gatewayIds.map(async (id) => [id, await getGatewayCredentialStatus(id)] as const),
  );
  return Object.fromEntries(entries);
}
