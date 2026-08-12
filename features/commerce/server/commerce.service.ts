import { hasExpired } from "@/lib/expiry-date";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import type { StoredCoupon } from "@/features/commerce/lib/coupons-repository";
import type { DeliveryZone } from "@/types/delivery";

import * as repo from "./commerce.repository";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

export function getCoupons() {
  return repo.listCoupons();
}

/**
 * What a customer's browser may see.
 *
 * The read on /api/coupons is public, because checkout validates a typed code in
 * the browser before the server re-resolves it. It was returning every coupon —
 * so anyone could list the shop's entire discount table, including codes that
 * are switched off, expired, or created for a campaign that has not launched.
 * A coupon code is not a secret exactly, but a 50%-off code the shop has not
 * advertised should not be one `curl` away.
 *
 * Only live codes go out; checkout refuses the others anyway, so nothing a
 * visitor can legitimately use is withheld.
 */
export async function getPublicCoupons() {
  const now = Date.now();
  return (await repo.listCoupons()).filter((coupon) => {
    if (!coupon.isActive) return false;
    if (hasExpired(coupon.expiresAt, now)) return false;
    return true;
  });
}

export async function replaceCoupons(
  coupons: StoredCoupon[],
  knownIds: string[] | null,
  ctx: RequestCtx,
) {
  await repo.replaceCoupons(coupons, knownIds);
  await writeAuditLog({
    action: "coupons.replace",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "coupons", id: "collection" },
    metadata: { count: coupons.length },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return repo.listCoupons();
}

export function getZones() {
  return repo.listZones();
}

/**
 * The delivery zones a customer's browser may see.
 *
 * The read on /api/delivery-zones is public, because the storefront has to tell
 * a visitor whether their pincode is served and what it costs. It was returning
 * every zone — including the ones the shop has switched OFF, with the charge and
 * the delivery window it used to quote for them. That is a public record of
 * which neighbourhoods a bakery has stopped serving and what it charged when it
 * did, from one `curl`, with no session.
 *
 * `findDeliveryZone` already filters on `isActive`, so nothing a visitor can
 * legitimately be quoted is withheld — the inactive rows were never used, only
 * shipped. Its two siblings on this same shape, /api/coupons and
 * /api/content/[key], were each narrowed this way; this one was missed.
 */
export async function getPublicZones() {
  return (await repo.listZones()).filter((zone) => zone.isActive);
}

export async function replaceZones(
  zones: DeliveryZone[],
  knownIds: string[] | null,
  ctx: RequestCtx,
) {
  await repo.replaceZones(zones, knownIds);
  await writeAuditLog({
    action: "delivery_zones.replace",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "delivery_zones", id: "collection" },
    metadata: { count: zones.length },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return repo.listZones();
}
