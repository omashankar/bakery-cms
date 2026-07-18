import {
  clearRazorpayConfig,
  getRazorpayStatus,
  saveRazorpayConfig,
} from "@/apps/admin/settings/lib/razorpay-config.server";

/** Returns connection status only — the secret key is never sent to the client. */
export async function GET() {
  return Response.json(getRazorpayStatus());
}

/** Saves admin-entered keys to the server-side config file. */
export async function POST(request: Request) {
  const status = getRazorpayStatus();
  if (status.envLocked) {
    return Response.json(
      { error: "Keys are set via environment variables (.env.local). Edit that file to change them." },
      { status: 409 }
    );
  }

  let body: { keyId?: string; keySecret?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const keyId = (body.keyId ?? "").trim();
  const keySecret = (body.keySecret ?? "").trim();

  if (!keyId || !keySecret) {
    return Response.json({ error: "Both Key ID and Key Secret are required" }, { status: 400 });
  }
  if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(keyId)) {
    return Response.json(
      { error: "Key ID must look like rzp_test_… or rzp_live_…" },
      { status: 400 }
    );
  }

  saveRazorpayConfig(keyId, keySecret);
  return Response.json(getRazorpayStatus());
}

/** Removes saved keys (disconnect). */
export async function DELETE() {
  const status = getRazorpayStatus();
  if (status.envLocked) {
    return Response.json(
      { error: "Keys are set via environment variables — cannot clear from admin." },
      { status: 409 }
    );
  }
  clearRazorpayConfig();
  return Response.json(getRazorpayStatus());
}
