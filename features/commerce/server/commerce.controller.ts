import { ok } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./commerce.service";
import { couponsArraySchema, deliveryZonesReplaceSchema } from "./commerce.validators";

const COMMERCE_ROLES = ["owner", "admin"] as const;

// ---- Coupons ----

export const getCouponsController = withErrorHandler(async () => {
  // Public read — the storefront checkout needs active coupons.
  return ok(await service.getCoupons(), "Coupons");
});

export const replaceCouponsController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...COMMERCE_ROLES);
  const coupons = validate(couponsArraySchema, await readJson(request));
  const result = await service.replaceCoupons(coupons, {
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
