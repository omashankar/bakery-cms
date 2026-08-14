import { describe, expect, it, vi } from "vitest";

import { paymentSchema } from "@/features/orders/server/order.validators";
import { customerMetaSchema } from "@/features/customers/server/customers.validators";

/**
 * A patch must not write fields it was not given.
 *
 * `saveMeta` named every field explicitly — `{ tags: input.tags, notes: ... }` —
 * so an absent one went to Mongo as `undefined` and was written anyway. With
 * the schema also defaulting each field, a note-only save stamped tags,
 * marketing opt-in and blocked back to whatever the caller's stale copy held.
 */
const upserts = vi.hoisted(() => [] as Array<{ email: string; fields: Record<string, unknown> }>);

vi.mock("@/features/customers/server/customers.repository", () => ({
  upsertMeta: async (email: string, fields: Record<string, unknown>) => {
    upserts.push({ email, fields });
    return { email, ...fields };
  },
  listMeta: async () => new Map(),
  getMeta: async () => undefined,
}));
vi.mock("@/features/orders/server/order.repository", () => ({
  listSince: async () => [],
  findByCustomerEmail: async () => [],
}));
vi.mock("@/lib/server/audit/audit-log", () => ({
  writeAuditLog: async () => undefined,
  requestContext: () => ({ ip: "", userAgent: "" }),
}));

import { saveMeta } from "@/features/customers/server/customers.service";

const CTX = { ip: "1.1.1.1", userAgent: "test" };

describe("saving customer metadata writes only what arrived", () => {
  it("passes just the mentioned field to the repository", async () => {
    upserts.length = 0;

    await saveMeta({ email: "a@b.com", notes: "calls ahead" }, CTX);

    expect(upserts).toHaveLength(1);
    expect(upserts[0].fields).toEqual({ notes: "calls ahead" });
  });

  it("drops an explicitly undefined field rather than writing it", async () => {
    upserts.length = 0;

    await saveMeta(
      { email: "a@b.com", notes: "hi", tags: undefined, blocked: undefined } as never,
      CTX,
    );

    expect(upserts[0].fields).toEqual({ notes: "hi" });
    expect(upserts[0].fields).not.toHaveProperty("tags");
    expect(upserts[0].fields).not.toHaveProperty("blocked");
  });

  it("still writes an explicit empty value", async () => {
    // "Not mentioned" and "set to empty" are different instructions.
    upserts.length = 0;

    await saveMeta({ email: "a@b.com", tags: [], marketingOptIn: false }, CTX);

    expect(upserts[0].fields).toEqual({ tags: [], marketingOptIn: false });
  });

  it("keys on the email without writing it as a field", async () => {
    upserts.length = 0;

    await saveMeta({ email: "a@b.com", notes: "x" }, CTX);

    // The email is the key, passed separately. Writing it into the patch would
    // make it just another `$set` field.
    expect(upserts[0].email).toBe("a@b.com");
    expect(upserts[0].fields).not.toHaveProperty("email");
  });

  it("the schema is what lowercases the address, before the service sees it", () => {
    // `saveMeta` takes an already-validated input, so the normalisation has to
    // happen at the edge — asserting it here would test nothing.
    const parsed = customerMetaSchema.parse({ email: "A@B.com", notes: "x" });
    expect(parsed.email).toBe("a@b.com");
  });
});

/**
 * Marking a payment refunded is not a way to refund it.
 *
 * `refunded` was settable through the payment endpoint, which only patches a
 * field: no gateway is contacted, no refund record is written, no money moves.
 * So an order could be marked payment-refunded with nothing behind it — the
 * Refund Centre found no record to show, the Payments page stopped counting the
 * money as collected, and the customer had been sent nothing.
 */
describe("the payment status endpoint", () => {
  it.each(["cod", "paid", "pending", "failed"])("accepts %s", (status) => {
    expect(paymentSchema.safeParse({ paymentStatus: status }).success).toBe(true);
  });

  it("refuses refunded, and says where to go instead", () => {
    const result = paymentSchema.safeParse({ paymentStatus: "refunded" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/refund action/i);
    }
  });

  it("refuses a status that is not a payment status at all", () => {
    expect(paymentSchema.safeParse({ paymentStatus: "cancelled" }).success).toBe(false);
  });
});
