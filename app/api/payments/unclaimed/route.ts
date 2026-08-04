import { NextResponse } from "next/server";

import { requireAdminResponse } from "@/lib/server/auth/guard";
import {
  listUnclaimedPayments,
  unclaimedPaymentTotal,
} from "@/features/payments/server/unclaimed-payment.repository";

/**
 * Money the shop received that never became an order.
 *
 * The screen an operator goes to when a customer says "I paid and got nothing"
 * is the Transaction Centre — and that is derived from orders, so it was
 * structurally incapable of showing a payment with no order behind it. This is
 * the list that can.
 */
export async function GET() {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  const [items, summary] = await Promise.all([listUnclaimedPayments(), unclaimedPaymentTotal()]);
  return Response.json({ items, ...summary });
}
