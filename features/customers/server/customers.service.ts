import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import * as orderRepo from "@/features/orders/server/order.repository";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import type { CustomerSegment } from "@/types/customer";

import * as repo from "./customers.repository";
import type { CustomerMetaInput } from "./customers.validators";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

interface CustomerRecord {
  id: string;
  email: string;
  name: string;
  phone: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
  lastOrderNumber: string;
}

// Server-side port of the pure derivation (avoids importing the client chain).
function buildRecords(orders: PlacedOrder[]): CustomerRecord[] {
  const map = new Map<string, CustomerRecord>();
  for (const order of orders) {
    const email = order.address?.email?.trim().toLowerCase();
    if (!email) continue;
    const existing = map.get(email);
    const newer = existing && new Date(order.placedAt).getTime() > new Date(existing.lastOrderAt).getTime();
    if (!existing) {
      map.set(email, {
        id: email,
        email: order.address.email,
        name: order.address.fullName,
        phone: order.address.phone,
        orderCount: 1,
        totalSpent: order.totals.total,
        lastOrderAt: order.placedAt,
        lastOrderNumber: order.orderNumber,
      });
      continue;
    }
    map.set(email, {
      ...existing,
      name: order.address.fullName || existing.name,
      phone: order.address.phone || existing.phone,
      orderCount: existing.orderCount + 1,
      totalSpent: existing.totalSpent + order.totals.total,
      lastOrderAt: newer ? order.placedAt : existing.lastOrderAt,
      lastOrderNumber: newer ? order.orderNumber : existing.lastOrderNumber,
    });
  }
  return [...map.values()].sort(
    (a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime(),
  );
}

function deriveSegment(record: CustomerRecord): CustomerSegment {
  if (record.orderCount >= 5 || record.totalSpent >= 5000) return "vip";
  const days = Math.floor((Date.now() - new Date(record.lastOrderAt).getTime()) / 86_400_000);
  if (days > 90) return record.orderCount >= 2 ? "at_risk" : "inactive";
  if (record.orderCount === 1) return "new";
  return "returning";
}

/** Customers list — derived from orders, joined with admin metadata. */
export async function getCustomers() {
  const [orders, metaMap] = await Promise.all([orderRepo.listAll(), repo.listMeta()]);
  const records = buildRecords(orders);
  return records.map((record) => ({
    ...record,
    segment: deriveSegment(record),
    meta: metaMap.get(record.email.toLowerCase()) ?? {
      email: record.email,
      tags: [],
      notes: "",
      marketingOptIn: true,
      blocked: false,
      updatedAt: new Date().toISOString(),
    },
  }));
}

/** Customer detail — the record, their orders, and admin metadata. */
export async function getCustomer(email: string) {
  const key = decodeURIComponent(email).trim().toLowerCase();
  const [orders, meta] = await Promise.all([orderRepo.findByCustomerEmail(key), repo.getMeta(key)]);
  if (orders.length === 0) {
    // No orders — still return the meta so an admin can view/edit it.
    return { record: null, orders: [], meta };
  }
  const record = buildRecords(orders)[0];
  return { record: { ...record, segment: deriveSegment(record) }, orders, meta };
}

export async function saveMeta(input: CustomerMetaInput, ctx: RequestCtx) {
  const saved = await repo.upsertMeta(input.email, {
    tags: input.tags,
    notes: input.notes,
    marketingOptIn: input.marketingOptIn,
    blocked: input.blocked,
  });
  await writeAuditLog({
    action: "customer.meta.update",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "customer", id: input.email },
    metadata: { tags: input.tags.length, blocked: input.blocked },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return saved;
}
