import { withoutStaffOnlyFields } from "@/features/orders/server/customer-view";
import { requestContext } from "@/lib/server/audit/audit-log";
import {
  clearCustomerCookie,
  setCustomerCookie,
} from "@/lib/server/auth/cookies";
import { getCustomerAccount, requireCustomer } from "@/lib/server/auth/customer-dal";
import { signCustomerToken } from "@/lib/server/auth/jwt";
import { AppError, ValidationError, withErrorHandler } from "@/lib/server/http/errors";
import { rateLimit } from "@/lib/server/http/rate-limit";
import { ok } from "@/lib/server/http/response";
import { isCrossSite } from "@/lib/server/http/same-site";
import { readJson, validate } from "@/lib/server/http/validate";
import * as orderService from "@/features/orders/server/order.service";
import { cancelAsCustomer } from "@/features/orders/server/cancellation.service";
import { rejectUnusableFile } from "@/features/uploads/server/photo-upload.service";

import * as service from "./customer-auth.service";
import {
  customerCancellationSchema,
  requestCodeSchema,
  savedAddressesSchema,
  updateCustomerProfileSchema,
  verifyCodeSchema,
} from "./customer-auth.validators";

/**
 * Storefront sign-in. Thin orchestration only — the service owns the rules.
 */

/**
 * Sending a code costs the shop an email and the recipient an inbox, so this is
 * budgeted twice.
 *
 * On the ADDRESS first, because that is the thing being harassed and the one an
 * attacker cannot rotate for free when the goal is to bury one person's inbox.
 * On the IP as well, but only when the deployment gives us a real one —
 * `requestContext` answers "" behind an untrusted proxy, and keying a limiter
 * on "" would put every visitor in one bucket, so one script could stop the
 * whole shop signing in.
 */
export const requestCodeController = withErrorHandler(async (request: Request) => {
  const ctx = requestContext(request);
  const input = validate(requestCodeSchema, await readJson(request));

  rateLimit(`customer-code:${input.email}`, { limit: 5, windowMs: 15 * 60 * 1000 });
  if (ctx.ip) rateLimit(`customer-code-ip:${ctx.ip}`, { limit: 20, windowMs: 15 * 60 * 1000 });

  const result = await service.requestSignInCode(input, ctx);
  return ok(result, "Sign-in code sent");
});

export const verifyCodeController = withErrorHandler(async (request: Request) => {
  const ctx = requestContext(request);
  const input = validate(verifyCodeSchema, await readJson(request));

  // Guessing is budgeted separately from sending: the per-code attempt counter
  // caps one code, this caps how fast someone can churn through codes.
  rateLimit(`customer-verify:${input.email}`, { limit: 10, windowMs: 15 * 60 * 1000 });

  const identity = await service.verifySignInCode(input, ctx);
  await setCustomerCookie(await signCustomerToken({ sub: identity.id, email: identity.email }));

  return ok(identity, "Signed in");
});

/**
 * Who is signed in, if anyone.
 *
 * Answers `null` rather than 401 for a signed-out visitor: the storefront asks
 * this on every page to decide whether to show an account menu, and a 401 there
 * is not an error, it is the ordinary answer for a shopper who has not signed
 * in.
 */
export const customerMeController = withErrorHandler(async () => {
  const account = (await getCustomerAccount()) as
    | { id: string; email: string; name: string; phone: string; avatarUrl?: string }
    | null;

  if (!account) return ok(null, "Not signed in");
  return ok(
    {
      id: account.id,
      email: account.email,
      name: account.name,
      phone: account.phone,
      avatarUrl: account.avatarUrl ?? "",
    },
    "Signed in",
  );
});

export const customerLogoutController = withErrorHandler(async () => {
  await clearCustomerCookie();
  return ok({ signedOut: true }, "Signed out");
});

export const updateCustomerProfileController = withErrorHandler(async (request: Request) => {
  const customer = await requireCustomer();
  const input = validate(updateCustomerProfileSchema, await readJson(request));

  // The stored account, not the session echoed back with the input: the
  // browser caches this reply, and an echo carried no photo.
  return ok(await service.updateProfile(customer.id, input), "Profile updated");
});

/**
 * The customer's own profile photo. Signed in, same-site, and budgeted — each
 * upload is a Cloudinary write — with the empty and oversized files refused
 * before the budget is charged, as the photo-cake upload learned to.
 */
export const uploadAvatarController = withErrorHandler(async (request: Request) => {
  if (isCrossSite(request)) {
    throw new AppError("Photo uploads are only accepted from this shop.", 403);
  }
  const customer = await requireCustomer();

  const form = await request.formData().catch(() => null);
  const file = form?.get("photo");
  if (!(file instanceof File)) {
    throw new ValidationError(
      [{ field: "photo", message: "No photo was received" }],
      "No photo was received",
    );
  }
  rejectUnusableFile(file);
  rateLimit(`customer-avatar:${customer.id}`, { limit: 10, windowMs: 60 * 60 * 1000 });

  return ok(await service.setAvatar(customer.id, file), "Photo updated");
});

export const removeAvatarController = withErrorHandler(async () => {
  const customer = await requireCustomer();
  return ok(await service.removeAvatar(customer.id), "Photo removed");
});

/**
 * A customer cancels one of THEIR orders, where its products allow it and the
 * shop has not started preparing it (see `cancelAsCustomer`).
 *
 * The email that proves ownership comes from the session; the order number
 * from the URL is only a name, checked against it in the service. Budgeted,
 * because each cancellation emails the customer.
 */
export const requestOrderCancellationController = withErrorHandler(
  async (request: Request, ctx: { params: Promise<{ orderNumber: string }> }) => {
    const customer = await requireCustomer();
    const { orderNumber } = await ctx.params;
    const requestCtx = requestContext(request);
    rateLimit(`customer-cancel:${customer.id}`, { limit: 10, windowMs: 15 * 60 * 1000 });

    const input = validate(customerCancellationSchema, await readJson(request));
    const order = await cancelAsCustomer(
      decodeURIComponent(orderNumber),
      customer.email,
      input.reason,
      { ...requestCtx, actorEmail: customer.email },
    );
    return ok(withoutStaffOnlyFields(order), "Order cancelled");
  },
);

/**
 * The signed-in customer's own address book — keyed on the SESSION, never on
 * anything in the request, so it cannot be pointed at another account's.
 */
export const myAddressesController = withErrorHandler(async () => {
  const customer = await requireCustomer();
  return ok(await service.getAddresses(customer.id), "Your addresses");
});

export const saveMyAddressesController = withErrorHandler(async (request: Request) => {
  const customer = await requireCustomer();
  const ctx = requestContext(request);
  // A save per click is the honest rate; this only stops a loop.
  rateLimit(`customer-addresses:${customer.id}`, { limit: 60, windowMs: 60 * 1000 });
  if (ctx.ip) rateLimit(`customer-addresses-ip:${ctx.ip}`, { limit: 120, windowMs: 60 * 1000 });

  const input = validate(savedAddressesSchema, await readJson(request));
  return ok(await service.saveAddresses(customer.id, input.addresses), "Addresses saved");
});

/**
 * The signed-in customer's own orders.
 *
 * The email comes from the SESSION, never from the request. The previous
 * endpoint took `?email=` and compared it to an admin session — which is the
 * right shape for staff looking a customer up, and no use at all to a customer,
 * who had no server session to compare against. My Orders therefore read this
 * browser's localStorage and nothing else: history was device-bound, frozen at
 * the moment of placing, and blind to any order the webhook had placed.
 */
export const myOrdersController = withErrorHandler(async () => {
  const customer = await requireCustomer();
  const orders = await orderService.getByCustomer(customer.email);
  return ok(orders.map(withoutStaffOnlyFields), "Your orders");
});
