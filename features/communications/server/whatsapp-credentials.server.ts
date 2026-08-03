import "server-only";

import { connectDB } from "@/lib/server/db/mongoose";
import { WhatsAppConnectionModel } from "@/lib/server/db/models/whatsapp-connection.model";
import type { WhatsAppConnection, WhatsAppConnectionStatus } from "@/types/whatsapp-provider";

/**
 * Reading and writing the WhatsApp access token — server side, and only there.
 *
 * `import "server-only"` turns "please don't import this from a client
 * component" into a build error, the same guard `gateway-credentials.server.ts`
 * uses. That module exists because eight gateways' live secrets had been
 * written to localStorage; there is no reason to learn that lesson twice.
 */

const CONNECTION_ID = "default";

const EMPTY: WhatsAppConnection = {
  phoneNumberId: "",
  businessAccountId: "",
  accessToken: "",
  enabled: false,
};

/** The full connection INCLUDING the token. Never return this to a client. */
export async function readWhatsAppConnection(): Promise<WhatsAppConnection> {
  await connectDB();
  const doc = await WhatsAppConnectionModel.findById(CONNECTION_ID).lean();
  if (!doc) return { ...EMPTY };

  return {
    phoneNumberId: doc.phoneNumberId ?? "",
    businessAccountId: doc.businessAccountId ?? "",
    accessToken: doc.accessToken ?? "",
    enabled: Boolean(doc.enabled),
  };
}

/**
 * What the browser is allowed to know: which fields are set, never the token.
 *
 * The two ids ARE echoed back — they are not secrets, and an admin looking at
 * this page needs to be able to tell WHICH WhatsApp number is connected. The
 * same reasoning as `publicHint` on the payment gateways.
 */
export async function readWhatsAppConnectionStatus(): Promise<WhatsAppConnectionStatus> {
  await connectDB();
  const doc = await WhatsAppConnectionModel.findById(CONNECTION_ID).lean();

  const phoneNumberId = doc?.phoneNumberId ?? "";
  const accessToken = doc?.accessToken ?? "";

  return {
    // Configured means a send could be ATTEMPTED — both halves present.
    configured: Boolean(phoneNumberId && accessToken),
    enabled: Boolean(doc?.enabled),
    phoneNumberId,
    businessAccountId: doc?.businessAccountId ?? "",
    tokenSet: Boolean(accessToken),
    updatedAt: doc?.updatedAt ?? null,
  };
}

export interface WhatsAppConnectionInput {
  phoneNumberId: string;
  businessAccountId: string;
  /** Blank means "leave the stored one alone" — see below. */
  accessToken: string;
  enabled: boolean;
}

/**
 * Saves the connection, keeping the stored token when none is supplied.
 *
 * The form never receives the token back, so it posts an empty field whenever
 * the admin did not retype it. Taking that literally would wipe a working token
 * every time somebody toggled `enabled` or corrected a typo in the phone id —
 * and the failure would show up later, on a customer's order, as a 401 from
 * Meta. `keepStoredMailPassword` handles the SMTP password the same way.
 *
 * The consequence is that a token cannot be CLEARED through this path. That is
 * deliberate: disconnecting is `enabled: false`, and a shop that truly wants the
 * token gone can save a new one.
 */
export async function saveWhatsAppConnection(
  input: WhatsAppConnectionInput,
): Promise<WhatsAppConnectionStatus> {
  await connectDB();

  const update: Record<string, unknown> = {
    phoneNumberId: input.phoneNumberId.trim(),
    businessAccountId: input.businessAccountId.trim(),
    enabled: input.enabled,
    updatedAt: new Date().toISOString(),
  };

  const token = input.accessToken.trim();
  if (token) update.accessToken = token;

  await WhatsAppConnectionModel.findByIdAndUpdate(
    CONNECTION_ID,
    { $set: update },
    // `_id` comes from the filter on an upsert; setting it again here is what
    // makes Mongo reject the write as modifying an immutable field.
    { upsert: true },
  );

  return readWhatsAppConnectionStatus();
}
