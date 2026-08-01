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

export async function replaceCoupons(coupons: StoredCoupon[], ctx: RequestCtx) {
  await repo.replaceCoupons(coupons);
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
