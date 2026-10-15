import { AppError, NotFoundError } from "@/lib/server/http/errors";
import * as productRepo from "@/features/products/server/product.repository";
import {
  DEFAULT_CANCELLATION_CLASS,
  customerCancellation,
  isCancellationClass,
  strictestClass,
  type CancellationClass,
} from "@/features/orders/lib/cancellation-policy";
import type { PlacedOrder } from "@/features/orders/lib/orders";

import * as repo from "./order.repository";
import { cancel } from "./order.service";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

/**
 * The class this order is judged by: the copy taken at placement, or — for an
 * order placed before copies existed — its products as they are now.
 */
async function policyClassOf(order: PlacedOrder): Promise<CancellationClass> {
  if (order.cancellationPolicy?.policyClass) return order.cancellationPolicy.policyClass;
  const classes = await Promise.all(
    [...new Set(order.items.map((item) => item.productSlug).filter(Boolean))].map(async (slug) => {
      const product = await productRepo.findBySlug(slug).catch(() => null);
      return isCancellationClass(product?.cancellationClass)
        ? product.cancellationClass
        : DEFAULT_CANCELLATION_CLASS;
    }),
  );
  return strictestClass(classes);
}

/**
 * THE CUSTOMER CANCELS their own order — when the products' "Order cancel"
 * toggle allows it and the shop has not started preparing it.
 *
 * Ownership is the SIGNED-IN customer's email; the order number from the URL
 * is only a name, and a stranger's order answers "not found", the same as a
 * missing one. The rule is enforced here, not only by the button.
 *
 * The cancelling itself is `cancel()`, the same one the admin uses: stock goes
 * back, the coupon is released, the customer is emailed, and a paid order
 * opens a refund request in the Refund Center for the shop to pay out.
 */
export async function cancelAsCustomer(
  orderNumber: string,
  customerEmail: string,
  reason: string | undefined,
  ctx: RequestCtx,
): Promise<PlacedOrder> {
  const order = await repo.findByNumber(orderNumber);
  const owner = order?.address?.email?.trim().toLowerCase();
  if (!order || !owner || owner !== customerEmail.trim().toLowerCase()) {
    throw new NotFoundError("Order not found");
  }

  const verdict = customerCancellation({ ...order, policyClass: await policyClassOf(order) });
  if (!verdict.allowed) throw new AppError(verdict.message, 409);

  const note = reason?.trim() ? `Cancelled by the customer: ${reason.trim().slice(0, 300)}` : "Cancelled by the customer";
  return (await cancel(order.id, note, ctx)) ?? order;
}
