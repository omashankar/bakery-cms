import { NextResponse } from "next/server";

import { requireAdminResponse } from "@/lib/server/auth/guard";
import { getGatewayConfig, isGatewayWired } from "@/features/payments/registry/gateways";
import {
  clearGatewayCredentials,
  getGatewayCredentialStatus,
  writeGatewayCredentials,
} from "@/features/payments/server/gateway-credentials.server";

/**
 * Gateway secrets, server side.
 *
 * These used to be saved by a client module straight into `localStorage` and
 * mirrored into an admin-config blob that any admin GET read back in full — so
 * a live Stripe secret key, a PayPal client secret, a PhonePe salt key and five
 * more sat in plaintext on the admin's own disk, survived logout, and were
 * re-pushed to every device that admin signed in from.
 *
 * The values now never leave the server. GET answers WHICH fields are set; it
 * cannot answer what they are.
 */

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  if (!getGatewayConfig(id)) return Response.json({ error: "Unknown gateway" }, { status: 404 });

  return Response.json(await getGatewayCredentialStatus(id));
}

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  const config = getGatewayConfig(id);
  if (!config) return Response.json({ error: "Unknown gateway" }, { status: 404 });

  // Refuse secrets for a gateway that cannot charge anyone.
  //
  // Ten of the twelve entries in the catalogue have no payment path, so storing
  // their keys achieves nothing except holding somebody's live `sk_live_` secret
  // on behalf of a feature that does not exist. The safest place for a credential
  // you cannot use is nowhere.
  if (!isGatewayWired(id)) {
    return Response.json(
      {
        error: `${config.name} is not available yet — it cannot take payments, so there is nothing to configure.`,
      },
      { status: 409 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  // Only the fields this gateway declares. An allow-list, so the request cannot
  // stuff arbitrary keys into the stored document.
  const allowed = new Set(config.configFields.map((field) => field.key));
  const patch: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (allowed.has(key) && typeof value === "string") patch[key] = value;
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nothing to save" }, { status: 400 });
  }

  // Blank fields are ignored rather than cleared — a secret input can never be
  // pre-filled with its current value, so saving the form after editing one
  // field would otherwise wipe every other secret on it.
  await writeGatewayCredentials(id, patch);
  return Response.json(await getGatewayCredentialStatus(id));
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;
  if (!getGatewayConfig(id)) return Response.json({ error: "Unknown gateway" }, { status: 404 });

  await clearGatewayCredentials(id);
  return Response.json(await getGatewayCredentialStatus(id));
}
