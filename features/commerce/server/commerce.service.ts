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
