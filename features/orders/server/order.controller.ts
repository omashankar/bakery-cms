import { ok, created } from "@/lib/server/http/response";
import { withErrorHandler, AppError, NotFoundError } from "@/lib/server/http/errors";
import { getMaintenanceState } from "@/features/settings/server/maintenance.server";
import { validate, readJson } from "@/lib/server/http/validate";
import { getSession, requireRole, requireSession } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";
import { rateLimit } from "@/lib/server/http/rate-limit";

import { verifyOrderLookup } from "@/features/orders/lib/order-tracking";
import { OutOfStockError } from "./order.repository";
import * as service from "./order.service";
import {
  placeOrderSchema,
  type PlaceOrderInput,
  statusSchema,
  cancelSchema,
  refundSchema,
  paymentSchema,
  deliveryPartnerSchema,
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


/**
 * How many orders one contact may place before the shop stops believing them.
 *
 * A prepaid order limits itself: the caller has to actually pay for each one,
 * and an unpaid attempt reserves nothing. Cash on delivery costs the caller
 * NOTHING and still runs the full placement — which atomically decrements
 * `stockQuantity` inside the same transaction, so a script can drive the whole
 * catalogue to out-of-stock in seconds and every real customer is then refused
 * at checkout. That is why the two are not held to the same number.
 *
 * Generous for a person: an ordinary customer places one order, occasionally a
 * second within the hour after getting something wrong. A script rotating
 * contacts still has to invent a fresh email AND a fresh phone per few orders,
 * which is the point — it makes the abuse expensive rather than free.
 */
const ORDER_WINDOW_MS = 60 * 60 * 1000;
const COD_PER_CONTACT = 5;
const PREPAID_PER_CONTACT = 15;
/**
 * The IP budget covers a shared address — a college, an office, a phone network
 * behind CGNAT — so it is far looser than the per-contact one and exists only to
 * stop a single machine cycling contacts.
 *
 * It is also the half that is currently INERT: `clientIpFrom` returns "" unless
 * `TRUST_PROXY_HEADERS=true`, which is deliberate (an untrusted
 * `x-forwarded-for` is caller-controlled, so throttling on it would let anyone
 * lock anyone else out). Until this shop is deployed behind a proxy that
 * overwrites the header, the contact limits below are the whole defence.
 */
const ORDERS_PER_IP = 40;

/**
 * Exported for tests, which is the only way to prove the BUDGETS.
 *
 * A source-level check can show a `rateLimit(` call exists and runs before the
 * placement. It cannot show that changing one field does not buy a fresh
 * budget, and that is the whole question here.
 */
export function throttleOrderPlacement(input: PlaceOrderInput, ip: string): void {
  const cod = input.paymentMethod === "cod";
  const limit = cod ? COD_PER_CONTACT : PREPAID_PER_CONTACT;
  const kind = cod ? "cod" : "prepaid";

  const email = input.address?.email?.trim().toLowerCase();
  const phone = input.address?.phone?.replace(/[^0-9]/g, "");

  /**
   * Email AND phone, not one of them.
   *
   * Both are required by `addressSchema`, and a caller changing only one is the
   * cheapest way past a single-key limit. Keyed separately rather than combined
   * so that neither can be varied to buy a fresh budget.
   */
  if (email) rateLimit(`order:${kind}:email:${email}`, { limit, windowMs: ORDER_WINDOW_MS });
  if (phone) rateLimit(`order:${kind}:phone:${phone}`, { limit, windowMs: ORDER_WINDOW_MS });
  if (ip) rateLimit(`order:ip:${ip}`, { limit: ORDERS_PER_IP, windowMs: ORDER_WINDOW_MS });
}

// ---- Public (customer) ----

export const placeOrderController = withErrorHandler(async (request: Request) => {
  // A closed shop must not take money. Hiding the storefront stops a customer
  // REACHING checkout, but this endpoint is reachable directly — and a cart that
  // was already open when the admin closed the shop would otherwise submit
  // straight through, producing an order nobody expects to fulfil.
  //
  // The exemptions are the same as the storefront's, so an admin can still place
  // a test order against a shop they have closed, which is often the reason it
  // is closed.
  const maintenance = await getMaintenanceState();
  if (maintenance.isClosed) {
    const message =
      maintenance.message || "The store is closed for maintenance. Please try again shortly.";
    // 503 is the honest status, but this client RETRIES every 5xx — it exists to
    // rescue a paid order from a dropped request. A closed shop will refuse all
    // three attempts, so the customer waits out the backoff and is then offered a
    // manual retry that cannot succeed. The `maintenance` marker is how the
    // client tells this refusal apart from an outage, without matching on prose.
    throw new AppError(message, 503, [{ field: "maintenance", message }]);
  }

  const input = validate(placeOrderSchema, await readJson(request));
  const context = requestContext(request);

  throttleOrderPlacement(input, context.ip);

  try {
    const order = await service.placeOrder(input, context);
    return created(order, "Order placed");
  } catch (error) {
    // A line could not be reserved. 409 rather than 5xx so the checkout client
    // does not retry it — the answer will be the same until stock changes — and
    // the customer is told which item, not handed a generic failure.
    if (error instanceof OutOfStockError) {
      throw new AppError(error.message, 409, [
        { field: "items", message: error.message },
      ]);
    }
    throw error;
  }
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
/**
 * The customer's copy of their own order.
 *
 * This endpoint serialised the whole document to anyone who could name the
 * order and its email — which is the customer, by design. That document
 * carries `adminNotes`, the field the admin UI labels "Internal notes" and
 * describes as visible only to admin staff, plus the refund record's internal
 * `notes` and the note on every refund history entry. Staff write things there
 * they would not say to the customer: why a complaint was refused, what a
 * previous call was like, what the shop thinks happened.
 *
 * A deny-list rather than an allow-list, deliberately. The customer order page,
 * the invoice and the tracking timeline read most of this document, and an
 * allow-list that missed one field would blank part of a page the customer is
 * entitled to see. Anything genuinely internal added later belongs here.
 */
function withoutStaffOnlyFields(order: Awaited<ReturnType<typeof service.getByNumber>>) {
  if (!order) return order;
  const { adminNotes: _adminNotes, refundRecord, ...rest } = order;

  return {
    ...rest,
    ...(refundRecord
      ? {
          refundRecord: {
            ...refundRecord,
            notes: undefined,
            history: refundRecord.history?.map((entry) => ({ ...entry, note: undefined })),
          },
        }
      : {}),
  };
}

export const getByNumberController = withErrorHandler(async (request: Request, ctx: NumberContext) => {
  const { orderNumber } = await ctx.params;
  const order = await service.getByNumber(orderNumber);
  if (!order) throw new NotFoundError("Order not found");

  const params = new URL(request.url).searchParams;
  const lookup = { email: params.get("email") ?? undefined, phone: params.get("phone") ?? undefined };
  if (verifyOrderLookup(order, lookup)) return ok(withoutStaffOnlyFields(order), "Order");

  const session = await getSession();
  if (session && ORDER_ROLES.includes(session.role as (typeof ORDER_ROLES)[number])) {
    return ok(order, "Order");
  }

  // Deliberately the same error as an unknown number: distinguishing them would
  // turn this into an oracle for which order numbers exist.
  throw new NotFoundError("Order not found");
});

/**
 * Emails the customer their own invoice.
 *
 * The storefront's "Email invoice" button toasted "Emailing invoices will be
 * enabled with the backend" — while the backend it was waiting for already
 * existed, and the `invoice` template was seeded ACTIVE and editable in the
 * admin. This is that backend.
 *
 * It sends only to the address ON THE ORDER, never to one supplied by the
 * caller: the same ownership rule as the lookup above, and the reason the
 * endpoint cannot be used to mail arbitrary people from the shop's domain. The
 * caller must already be able to prove they own the order — the exact same
 * `verifyOrderLookup` check — or be an admin.
 */
export const emailInvoiceController = withErrorHandler(
  async (request: Request, ctx: NumberContext) => {
    const { orderNumber } = await ctx.params;
    const order = await service.getByNumber(orderNumber);
    if (!order) throw new NotFoundError("Order not found");

    const params = new URL(request.url).searchParams;
    const lookup = {
      email: params.get("email") ?? undefined,
      phone: params.get("phone") ?? undefined,
    };

    let allowed = verifyOrderLookup(order, lookup);
    if (!allowed) {
      const session = await getSession();
      allowed = Boolean(
        session && ORDER_ROLES.includes(session.role as (typeof ORDER_ROLES)[number]),
      );
    }
    // Same 404 as an unknown number, for the same reason as the lookup.
    if (!allowed) throw new NotFoundError("Order not found");

    const result = await service.emailInvoice(order);
    if (!result.sent) {
      throw new AppError(result.error ?? "Could not send the invoice email", 502);
    }

    return ok({ to: order.address.email }, "Invoice sent");
  },
);

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

export const deliveryPartnerController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const session = await requireRole(...ORDER_ROLES);
  const { id } = await ctx.params;
  const input = validate(deliveryPartnerSchema, await readJson(request));
  const order = await service.updateDeliveryPartner(id, input, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(order, input.name.trim() ? "Delivery partner assigned" : "Delivery partner cleared");
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
