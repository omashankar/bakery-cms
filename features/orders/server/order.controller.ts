import { ok, created } from "@/lib/server/http/response";
import { withErrorHandler, NotFoundError } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { getSession, requireRole, requireSession } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import { verifyOrderLookup } from "@/features/orders/lib/order-tracking";
import * as service from "./order.service";
import {
  placeOrderSchema,
  statusSchema,
  cancelSchema,
  refundSchema,
  paymentSchema,
  notesSchema,
  refundNotesSchema,
  refundRequestSchema,
  orderQuerySchema,
  orderAnalyticsQuerySchema,
  refundCasesQuerySchema,
  invoicesQuerySchema,
  transactionsQuerySchema,
} from "./order.validators";
import {
  getCommerceOverviews,
  getInvoicesPage,
  getOrderAnalytics,
  getRefundCasesPage,
  getTransactionsPage,
} from "./order.analytics";

const ORDER_ROLES = ["owner", "admin"] as const;
type IdContext = { params: Promise<{ id: string }> };
type NumberContext = { params: Promise<{ orderNumber: string }> };

// ---- Public (customer) ----

export const placeOrderController = withErrorHandler(async (request: Request) => {
  const input = validate(placeOrderSchema, await readJson(request));
  const order = await service.placeOrder(input, requestContext(request));
  return created(order, "Order placed");
});

/**
 * Order tracking by number — the customer-facing "where is my order" lookup.
 *
 * The number alone is not a secret: it is `BK-<date>-<4 digits>`, so anyone can
 * walk 9,000 values for a given day and read a stranger's name, phone, street
 * address and every line item. The storefront's own track form has always
 * demanded the order number AND the email on the confirmation; this endpoint
 * now demands the same. An admin may look up any order.
 */
export const getByNumberController = withErrorHandler(async (request: Request, ctx: NumberContext) => {
  const { orderNumber } = await ctx.params;
  const order = await service.getByNumber(orderNumber);
  if (!order) throw new NotFoundError("Order not found");

  const params = new URL(request.url).searchParams;
  const lookup = { email: params.get("email") ?? undefined, phone: params.get("phone") ?? undefined };
  if (verifyOrderLookup(order, lookup)) return ok(order, "Order");

  const session = await getSession();
  if (session && ORDER_ROLES.includes(session.role as (typeof ORDER_ROLES)[number])) {
    return ok(order, "Order");
  }

  // Deliberately the same error as an unknown number: distinguishing them would
  // turn this into an oracle for which order numbers exist.
  throw new NotFoundError("Order not found");
});

/**
 * A customer's own order history.
 *
 * This was unauthenticated: anyone could pass ?email= and receive that person's
 * full history — name, phone, street address, every line item and total. A
 * caller may read their OWN orders; reading anyone else's is an admin action.
 */
export const customerOrdersController = withErrorHandler(async (request: Request) => {
  const session = await requireSession();
  const email = new URL(request.url).searchParams.get("email");
  if (!email) return ok([], "No email provided");

  const isSelf = email.trim().toLowerCase() === session.email.trim().toLowerCase();
  if (!isSelf) await requireRole(...ORDER_ROLES);

  return ok(await service.getByCustomer(email), "Customer orders");
});

// ---- Admin ----

/**
 * Admin order list. Accepts filters + `page`/`limit` and always reports the
 * total matching count, so the table can page through the whole collection
 * instead of whatever fits in one capped response.
 *
 * With no params this is page 1 at the previous 500-row default, which is what
 * the client-side cache hydration (`useOrdersServerSync`) still asks for.
 */
export const listOrdersController = withErrorHandler(async (request: Request) => {
  await requireRole(...ORDER_ROLES);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = validate(orderQuerySchema, params);
  const { items, total } = await service.getOrdersPage(query);

  return ok(items, "Orders", {
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  });
});

export const orderStatsController = withErrorHandler(async () => {
  await requireRole(...ORDER_ROLES);
  return ok(await service.getStats(), "Order stats");
});

/**
 * Report + dashboard analytics over every order in the requested window.
 *
 * The admin used to compute these in the browser from a cached slice of recent
 * orders, so revenue, trends and top-sellers all quietly shrank once a shop
 * outgrew the cache.
 */
export const orderAnalyticsController = withErrorHandler(async (request: Request) => {
  await requireRole(...ORDER_ROLES);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const { range, timeZone } = validate(orderAnalyticsQuerySchema, params);
  return ok(await getOrderAnalytics(range, timeZone), "Order analytics");
});

/** Refund, invoice and payment overview counters, over every order. */
export const commerceOverviewsController = withErrorHandler(async (request: Request) => {
  await requireRole(...ORDER_ROLES);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const { timeZone } = validate(orderAnalyticsQuerySchema, params);
  return ok(await getCommerceOverviews(timeZone), "Commerce overviews");
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

export const refundNotesController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const session = await requireRole(...ORDER_ROLES);
  const { id } = await ctx.params;
  const { notes } = validate(refundNotesSchema, await readJson(request));
  const order = await service.updateRefundNotes(id, notes, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(order, "Refund notes saved");
});

export const requestRefundController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const session = await requireRole(...ORDER_ROLES);
  const { id } = await ctx.params;
  const input = validate(refundRequestSchema, await readJson(request));
  const order = await service.requestRefund(id, input, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(order, "Refund requested");
});

/**
 * The three commerce list screens. Each returns its filtered page AND its
 * overview counters from one snapshot, so a tab badge can never disagree with
 * the rows under it.
 */
export const refundCasesController = withErrorHandler(async (request: Request) => {
  await requireRole(...ORDER_ROLES);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const { page, limit, ...filters } = validate(refundCasesQuerySchema, params);
  const result = await getRefundCasesPage(filters, page, limit);
  return ok(result, "Refund cases", {
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
    },
  });
});

export const invoicesController = withErrorHandler(async (request: Request) => {
  await requireRole(...ORDER_ROLES);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const { page, limit, ...filters } = validate(invoicesQuerySchema, params);
  const result = await getInvoicesPage(filters, page, limit);
  return ok(result, "Invoices", {
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
    },
  });
});

export const transactionsListController = withErrorHandler(async (request: Request) => {
  await requireRole(...ORDER_ROLES);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const { page, limit, ...filters } = validate(transactionsQuerySchema, params);
  const result = await getTransactionsPage(filters, page, limit);
  return ok(result, "Transactions", {
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
    },
  });
});
