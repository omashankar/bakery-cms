import { NextResponse } from "next/server";

import { requireAdminResponse } from "@/lib/server/auth/guard";
import { markUnclaimedPaymentRefunded } from "@/features/payments/server/unclaimed-payment.repository";
import { writeAuditLog, requestContext } from "@/lib/server/audit/audit-log";

/**
 * Record that an unclaimed payment was sent back to the customer.
 *
 * `refundedAt` existed on the model with no writer, so the only way off the
 * unclaimed list was to attach an order — and a payment that has been refunded
 * can never have one. The money went back and the row stayed on the operator's
 * alert forever, counted in its total.
 *
 * The refund itself happens at the gateway. There is no order here for the
 * refund path to work against, so an operator issues it in the Razorpay
 * dashboard and records it here — which is why this writes a timestamp rather
 * than moving money, and why the audit entry matters.
 */
type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  const { id } = await ctx.params;

  try {
    const marked = await markUnclaimedPaymentRefunded(id);
    if (!marked) {
      // Already refunded, already attached to an order, or gone. Saying so beats
      // a 200 that implies this request changed something.
      return NextResponse.json(
        { error: "That payment is no longer outstanding." },
        { status: 409 },
      );
    }

    await writeAuditLog({
      action: "payment.unclaimed.refunded",
      actorId: auth.sub,
      actorEmail: auth.email,
      target: { type: "payment", id },
      ...requestContext(request),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not record the refund" }, { status: 500 });
  }
}
