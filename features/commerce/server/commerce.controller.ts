import { ok } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { getSession, requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./commerce.service";
import { couponsReplaceSchema, deliveryZonesReplaceSchema } from "./commerce.validators";

const COMMERCE_ROLES = ["owner", "admin"] as const;

// ---- Coupons ----

export const getCouponsController = withErrorHandler(async () => {
  // Public read — checkout validates a typed code in the browser before the
  // server re-resolves it. A visitor gets only the codes they could actually
  // use; it used to hand out the shop's whole discount table, switched-off and
  // unlaunched codes included. Staff ask as an authenticated caller.
  const session = await getSession();
  const isStaff = Boolean(session && COMMERCE_ROLES.includes(session.role as never));

  return ok(
    isStaff ? await service.getCoupons() : await service.getPublicCoupons(),
    "Coupons",
  );
});

export const replaceCouponsController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...COMMERCE_ROLES);
  const { coupons, knownIds } = validate(couponsReplaceSchema, await readJson(request));
  const result = await service.replaceCoupons(coupons, knownIds, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, "Coupons saved");
});

// ---- Delivery zones ----

export const getZonesController = withErrorHandler(async () => {
  return ok(await service.getZones(), "Delivery zones");
});

export const replaceZonesController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...COMMERCE_ROLES);
  const { zones, knownIds } = validate(deliveryZonesReplaceSchema, await readJson(request));
  const result = await service.replaceZones(zones, knownIds, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, "Delivery zones saved");
});
