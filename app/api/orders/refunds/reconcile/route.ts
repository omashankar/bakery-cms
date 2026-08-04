import { NextResponse } from "next/server";

import { requireAdminResponse } from "@/lib/server/auth/guard";
import * as orderService from "@/features/orders/server/order.service";

/**
 * Settle refunds the gateway never told us about.
 *
 * A gateway refund is created `pending` and becomes `processed` at the bank's
 * pace; `refund.processed` on the webhook is what promotes the record. But a
 * webhook is a delivery someone else makes, and it can simply not arrive — no
 * secret configured, a wrong URL, Razorpay exhausting its retries. The refund
 * then sits at `processing` forever while the money has almost certainly gone,
 * and the Refund Centre is the last place to find out.
 *
 * Called by the Refund Centre when it loads (so an operator looking at the
 * problem is the one who triggers the fix), and available to a scheduler.
 */
export async function POST() {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await orderService.reconcilePendingRefunds();
    return Response.json(result);
  } catch (error) {
    console.error(`[orders] Refund reconciliation failed: ${String(error)}`);
    return Response.json({ error: "Could not reconcile refunds" }, { status: 500 });
  }
}
