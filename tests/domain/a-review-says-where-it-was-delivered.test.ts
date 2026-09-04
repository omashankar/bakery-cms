import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Delivered in Mumbai" is a claim about a purchase, so it cannot come from the
 * form.
 *
 * `orderNumber` had been on the review type since the beginning and NOTHING ever
 * wrote it, so the line the reference storefront prints beside every review had
 * no honest source and was simply left off the page. The tempting shortcut is
 * `authorEmail` — it is right there in the submission — but that field is
 * whatever the browser typed. Keyed on it, anyone could type a stranger's
 * address, be told their order went to Mumbai, and have it printed under their
 * own review as a fact about a purchase they never made.
 *
 * So it is resolved from the SIGNED-IN account, against an order that actually
 * reached Delivered, and stamped onto the row at the time — because an address
 * can be edited or an order deleted, and a review that has sat on the page for a
 * year must not silently start naming a different city.
 */

const account = vi.hoisted(() => ({ current: null as { email?: string } | null }));
const orders = vi.hoisted(() => ({ list: [] as unknown[] }));
const created = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));

vi.mock("@/lib/server/auth/customer-dal", () => ({
  getCustomerAccount: vi.fn(async () => account.current),
}));
vi.mock("@/features/orders/server/order.repository", () => ({
  findByCustomerEmail: vi.fn(async () => orders.list),
}));
vi.mock("@/features/reviews/server/review.repository", () => ({
  create: vi.fn(async (row: Record<string, unknown>) => {
    created.rows.push(row);
    return row;
  }),
  approvedAggregate: vi.fn(async () => ({ average: 0, count: 0 })),
}));
vi.mock("@/features/products/server/product.repository", () => ({
  findBySlug: vi.fn(async () => ({ id: "p-1", slug: "black-forest", name: "Black Forest" })),
  setReviewAggregate: vi.fn(async () => undefined),
}));
vi.mock("@/lib/server/audit/audit-log", () => ({
  writeAuditLog: vi.fn(async () => undefined),
  requestContext: () => ({ ip: "1.1.1.1", userAgent: "test" }),
}));

const { submitReview } = await import("@/features/reviews/server/review.service");

const CTX = { ip: "1.1.1.1", userAgent: "test" };

const SUBMISSION = {
  productSlug: "black-forest",
  authorName: "Asha",
  authorEmail: "asha@example.com",
  rating: 5,
  body: "Lovely.",
};

/** One order, as the shop stored it. */
function order(overrides: Record<string, unknown> = {}) {
  return {
    orderNumber: "ORD-1001",
    status: "delivered",
    placedAt: "2026-08-01T10:00:00.000Z",
    address: { city: "Mumbai", email: "asha@example.com" },
    items: [{ productSlug: "black-forest", name: "Black Forest", quantity: 1, price: 800 }],
    ...overrides,
  };
}

beforeEach(() => {
  account.current = null;
  orders.list = [];
  created.rows = [];
});

describe("a review by somebody the shop actually delivered to", () => {
  it("says where it went", async () => {
    account.current = { email: "asha@example.com" };
    orders.list = [order()];

    await submitReview(SUBMISSION as never, CTX);

    expect(created.rows[0]?.deliveredCity).toBe("Mumbai");
    expect(created.rows[0]?.orderNumber).toBe("ORD-1001");
  });

  it("picks the most recent delivery, which is the one they are writing about", async () => {
    // The repository already answers newest-first.
    account.current = { email: "asha@example.com" };
    orders.list = [
      order({ orderNumber: "ORD-2002", address: { city: "Pune" } }),
      order({ orderNumber: "ORD-1001", address: { city: "Mumbai" } }),
    ];

    await submitReview(SUBMISSION as never, CTX);

    expect(created.rows[0]?.deliveredCity).toBe("Pune");
  });
});

describe("what does not earn the line", () => {
  it("says nothing for a reviewer who is not signed in", async () => {
    /**
     * THE SPOOF. The submission carries `authorEmail`, and there is an order in
     * the database for that address — but the browser typed it. Resolving from
     * it would let anybody claim a stranger's delivery.
     */
    account.current = null;
    orders.list = [order()];

    await submitReview(SUBMISSION as never, CTX);

    expect(created.rows[0]?.deliveredCity).toBeUndefined();
    expect(created.rows[0]?.orderNumber).toBeUndefined();
  });

  it("says nothing while the order is still on its way", async () => {
    // A review written the hour an order goes in is a review of the ordering.
    // "Delivered in Mumbai" would be describing a delivery that has not
    // happened.
    account.current = { email: "asha@example.com" };
    orders.list = [order({ status: "out_for_delivery" })];

    await submitReview(SUBMISSION as never, CTX);

    expect(created.rows[0]?.deliveredCity).toBeUndefined();
  });

  it("says nothing when the delivered order was for something else", async () => {
    account.current = { email: "asha@example.com" };
    orders.list = [
      order({ items: [{ productSlug: "red-velvet", name: "Red Velvet", quantity: 1, price: 900 }] }),
    ];

    await submitReview(SUBMISSION as never, CTX);

    expect(created.rows[0]?.deliveredCity).toBeUndefined();
  });

  it("says nothing when the order carries no city", async () => {
    account.current = { email: "asha@example.com" };
    orders.list = [order({ address: { city: "   " } })];

    await submitReview(SUBMISSION as never, CTX);

    expect(created.rows[0]?.deliveredCity).toBeUndefined();
    // …and no order number either: the two are stamped together or not at all,
    // so the page never shows a half state it cannot account for.
    expect(created.rows[0]?.orderNumber).toBeUndefined();
  });
});

describe("what the public endpoint is allowed to say", () => {
  it("publishes the city and keeps the order number", async () => {
    /**
     * The projection is a whitelist precisely so a field added to the model is
     * private until somebody decides otherwise. The city is a fact about this
     * review; the order number is a handle on somebody's order, and the
     * storefront has no use for it.
     */
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync("features/reviews/server/review.repository.ts", "utf8"),
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
    const fields = code.slice(
      code.indexOf("const PUBLIC_REVIEW_FIELDS"),
      code.indexOf("export async function listApprovedByProduct"),
    );

    expect(fields).toContain("deliveredCity: 1");
    expect(fields).not.toContain("orderNumber");
    expect(fields).not.toContain("authorEmail");
  });
});
