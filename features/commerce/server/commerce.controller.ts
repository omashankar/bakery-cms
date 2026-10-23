import { ok } from "@/lib/server/http/response";
import { ValidationError, withErrorHandler } from "@/lib/server/http/errors";
import { describePincodeCode, listDistricts } from "./pincode-directory";
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
  // Public read — checkout has to tell a visitor whether their pincode is
  // served. Scoped the same way the coupons read above is: a visitor sees the
  // live zones, staff see the switched-off ones they have to manage.
  const session = await getSession();
  const isStaff = Boolean(session && COMMERCE_ROLES.includes(session.role as never));

  return ok(
    isStaff ? await service.getZones() : await service.getPublicZones(),
    "Delivery zones",
  );
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

// ---- PIN code directory ----

/** At most this many codes per request — a zone form's chips, not a scrape. */
const MAX_CODES = 100;
/** The directory changes when the data file is rebuilt, not between requests. */
const DIRECTORY_CACHE = { "Cache-Control": "public, max-age=86400, s-maxage=86400" };

/**
 * What India Post says about PIN codes — public, because the product page,
 * the header and checkout all ask it before anyone signs in.
 *
 *   ?codes=324005,3240  → { "324005": { kind: "pin", place }, "3240": { kind: "prefix", summary } }
 *   ?districts=1        → every district, its state and PIN count
 */
export const getPincodesController = withErrorHandler(async (request: Request) => {
  const params = new URL(request.url).searchParams;
  if (params.get("districts")) {
    return ok(listDistricts(), "Districts", { headers: DIRECTORY_CACHE });
  }

  const codes = [...new Set((params.get("codes") ?? "").split(",").map((code) => code.trim()).filter(Boolean))];
  const invalid = codes.filter((code) => !/^[1-9]\d{2,5}$/.test(code));
  if (codes.length === 0 || codes.length > MAX_CODES || invalid.length > 0) {
    throw new ValidationError([
      {
        field: "codes",
        message: invalid.length
          ? `Not a PIN code or prefix: ${invalid.slice(0, 5).join(", ")}`
          : `Ask for 1–${MAX_CODES} PIN codes`,
      },
    ]);
  }
  return ok(
    Object.fromEntries(codes.map((code) => [code, describePincodeCode(code)])),
    "PIN codes",
    { headers: DIRECTORY_CACHE },
  );
});
