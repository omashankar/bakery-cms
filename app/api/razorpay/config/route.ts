import { NextResponse } from "next/server";

import {
  clearRazorpayConfig,
  getRazorpayStatus,
  saveRazorpayConfig,
  verifyRazorpayCredentials,
} from "@/lib/server/payments/razorpay-credentials";
import { requireAdminResponse } from "@/lib/server/auth/guard";

/**
 * Connection status only — no secret is ever in a response from this route.
 *
 * Now behind the same guard as POST and DELETE. It was the one unauthenticated
 * verb here, and while it returns no secret it does return the live key id, the
 * test/live mode and whether a webhook is configured — a free reconnaissance
 * read of the shop's payment setup for anyone who asks.
 */
export async function GET(request: Request) {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  const status = await getRazorpayStatus();

  // `?verify=1` asks Razorpay whether the keys actually work, rather than only
  // whether two variables are non-empty. Opt-in because it is a network call:
  // the admin screens want it, the plain status read does not.
  if (new URL(request.url).searchParams.get("verify") === "1" && status.configured) {
    const check = await verifyRazorpayCredentials();
    return Response.json({ ...status, verified: check.reachable, verifyError: check.error ?? null });
  }

  return Response.json({ ...status, verified: null, verifyError: null });
}

/** Saves admin-entered keys server-side (Mongo), never to the browser. */
export async function POST(request: Request) {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  const status = await getRazorpayStatus();

  let body: { keyId?: string; keySecret?: string; webhookSecret?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const keyId = (body.keyId ?? "").trim();
  const keySecret = (body.keySecret ?? "").trim();
  const webhookSecret = (body.webhookSecret ?? "").trim();

  // The webhook secret is independent of the API keys: a shop whose keys come
  // from the environment still has to be able to set it here, because there is
  // no other way in. Refusing the whole request when `envLocked` is what left
  // the webhook permanently unconfigurable for those shops.
  if (status.envLocked && (keyId || keySecret)) {
    return Response.json(
      {
        error:
          "API keys are set via environment variables (.env.local). Edit that file to change them.",
      },
      { status: 409 },
    );
  }
  if (status.webhookEnvLocked && webhookSecret) {
    return Response.json(
      { error: "The webhook secret is set via RAZORPAY_WEBHOOK_SECRET. Edit that file to change it." },
      { status: 409 },
    );
  }

  if (!keyId && !keySecret && !webhookSecret) {
    return Response.json({ error: "Nothing to save" }, { status: 400 });
  }

  // Keys are all-or-nothing: half a pair authenticates nothing. The webhook
  // secret stands alone.
  if ((keyId || keySecret) && !(keyId && keySecret)) {
    return Response.json(
      { error: "Both Key ID and Key Secret are required to change the keys" },
      { status: 400 },
    );
  }
  if (keyId && !/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
    return Response.json({ error: "Key ID must look like rzp_test_… or rzp_live_…" }, { status: 400 });
  }

  await saveRazorpayConfig({
    ...(keyId ? { keyId } : {}),
    ...(keySecret ? { keySecret } : {}),
    ...(webhookSecret ? { webhookSecret } : {}),
  });
  return Response.json(await getRazorpayStatus());
}

/** Removes saved keys (disconnect). */
export async function DELETE() {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  const status = await getRazorpayStatus();
  if (status.envLocked) {
    return Response.json(
      { error: "Keys are set via environment variables — cannot clear from admin." },
      { status: 409 },
    );
  }
  await clearRazorpayConfig();
  return Response.json(await getRazorpayStatus());
}
