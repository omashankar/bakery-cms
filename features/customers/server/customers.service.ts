import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import * as orderRepo from "@/features/orders/server/order.repository";
import {
  buildCustomerProfiles,
  buildCustomerRecords,
  deriveCustomerSegment,
  type CustomerMeta,
} from "@/features/customers/lib/customer-profiles";

import * as repo from "./customers.repository";
import type { CustomerMetaInput } from "./customers.validators";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

/**
 * Every customer, with their full profile and admin metadata.
 *
 * Built over EVERY order rather than a capped slice: a customer only exists as
 * the sum of their orders, so a cap does not shorten this list — it removes
 * older customers entirely and understates the spend of the ones left.
 */
export async function getCustomers() {
  const [orders, metaMap] = await Promise.all([orderRepo.listSince(null), repo.listMeta()]);
  // `customerKey` is how the meta store keys its rows, so the join cannot miss
  // on stray casing or whitespace in the address the customer typed.
  return buildCustomerProfiles(orders, (key) => metaMap.get(key) as CustomerMeta | undefined);
}

/**
 * Just the admin's own notes on customers — tags, notes, marketing consent.
 *
 * Separate from `getCustomers` because the shapes cost wildly different things.
 * A customer PROFILE is derived: it only exists as the sum of that person's
 * orders, so building the list reads every order in the shop and maps every one
 * of them. This is a single small collection with one document per customer the
 * admin has annotated, and nothing else touched.
 *
 * That difference is the whole reason this exists. The admin layout hydrates the
 * meta on entering the admin, and it was doing it by calling `/api/customers`
 * and keeping only the `meta` field off each row — so every admin page load
 * pulled the entire orders collection, derived every profile, serialised the
 * lot, and the browser threw all of it away except the notes.
 */
export async function getCustomerMeta() {
  const map = await repo.listMeta();
  return Object.fromEntries(map);
}

/**
 * Customer detail — their full profile, every order they have placed, and the
 * admin metadata.
 *
 * `findByCustomerEmail` queries by address rather than paging the collection, so
 * this sees all of a customer's history however long ago they first ordered.
 */
export async function getCustomer(email: string) {
  const key = decodeURIComponent(email).trim().toLowerCase();
  const [orders, meta] = await Promise.all([orderRepo.findByCustomerEmail(key), repo.getMeta(key)]);
  if (orders.length === 0) {
    // No orders — still return the meta so an admin can view/edit it.
    return { record: null, profile: null, orders: [], meta };
  }

  const record = buildCustomerRecords(orders)[0];
  const profile = buildCustomerProfiles(orders, () => meta as CustomerMeta | undefined)[0];

  return {
    record: { ...record, segment: deriveCustomerSegment(record) },
    profile,
    orders,
    meta,
  };
}

export async function saveMeta(input: CustomerMetaInput, ctx: RequestCtx) {
  // Only what arrived. Naming every field wrote each one whether or not the
  // request mentioned it, so a note-only save also stamped tags, marketing
  // opt-in and blocked back to whatever the caller's stale copy held.
  const { email, ...patch } = input;
  const fields = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  );

  const saved = await repo.upsertMeta(email, fields);
  await writeAuditLog({
    action: "customer.meta.update",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "customer", id: input.email },
    metadata: { fields: Object.keys(fields) },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return saved;
}
