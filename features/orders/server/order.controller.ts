import { ok, created } from "@/lib/server/http/response";
import { withErrorHandler, NotFoundError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./order.service";
import {
  placeOrderSchema,
  statusSchema,
  cancelSchema,
  refundSchema,
  paymentSchema,
  notesSchema,
} from "./order.validators";

const ORDER_ROLES = ["owner", "admin"] as const;
type IdContext = { params: Promise<{ id: string }> };
type NumberContext = { params: Promise<{ orderNumber: string }> };

// ---- Public (customer) ----

export const placeOrderController = withErrorHandler(async (request: Request) => {
  const input = validate(placeOrderSchema, await readJson(request));
  const order = await service.placeOrder(input, requestContext(request));
  return created(order, "Order placed");
});

export const getByNumberController = withErrorHandler(async (_req: Request, ctx: NumberContext) => {
  const { orderNumber } = await ctx.params;
  const order = await service.getByNumber(orderNumber);
  if (!order) throw new NotFoundError("Order not found");
  return ok(order, "Order");
});

export const customerOrdersController = withErrorHandler(async (request: Request) => {
  const email = new URL(request.url).searchParams.get("email");
  if (!email) return ok([], "No email provided");
  return ok(await service.getByCustomer(email), "Customer orders");
});

// ---- Admin ----

export const listOrdersController = withErrorHandler(async () => {
  await requireRole(...ORDER_ROLES);
  return ok(await service.getOrders(), "Orders");
});

export const getOrderController = withErrorHandler(async (_req: Request, ctx: IdContext) => {
  await requireRole(...ORDER_ROLES);
  const { id } = await ctx.params;
  const order = await service.getById(id);
  if (!order) throw new NotFoundError("Order not found");
  return ok(order, "Order");
});

export const updateStatusController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const session = await requireRole(...ORDER_ROLES);
  const { id } = await ctx.params;
  const { status } = validate(statusSchema, await readJson(request));
  const order = await service.updateStatus(id, status, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(order, "Order status updated");
});

export const cancelOrderController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const session = await requireRole(...ORDER_ROLES);
  const { id } = await ctx.params;
  const { cancellationReason } = validate(cancelSchema, await readJson(request));
  const order = await service.cancel(id, cancellationReason, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(order, "Order cancelled");
});

export const refundOrderController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const session = await requireRole(...ORDER_ROLES);
  const { id } = await ctx.params;
  const input = validate(refundSchema, await readJson(request));
  const order = await service.refund(id, input, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(order, "Order refunded");
});

export const paymentStatusController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const session = await requireRole(...ORDER_ROLES);
  const { id } = await ctx.params;
  const { paymentStatus, paymentReference } = validate(paymentSchema, await readJson(request));
  const order = await service.updatePayment(id, paymentStatus, paymentReference, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(order, "Payment status updated");
});

export const adminNotesController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const session = await requireRole(...ORDER_ROLES);
  const { id } = await ctx.params;
  const { adminNotes } = validate(notesSchema, await readJson(request));
  const order = await service.updateAdminNotes(id, adminNotes, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(order, "Notes saved");
});
