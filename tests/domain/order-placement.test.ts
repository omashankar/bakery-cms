/**
 * Placing an order is the one write in this codebase where a false success costs
 * real money. By the time it runs the customer's card has been charged; the
 * local write is only a cache, so an order the server never received exists in
 * that one browser and nowhere else — the customer holds a confirmation number,
 * the tracking page finds it (it reads the same cache), and the bakery never
 * sees the order at all.
 *
 * So: `persisted` must be the truth about the SERVER, the request must survive a
 * transient blip, and a retry must never turn one paid order into two.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { calculateCartTotals } from "@/features/orders/lib/cart-totals";
import { confirmOrder, getOrders, placeOrder } from "@/features/orders/lib/orders";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import type { CartLineItem } from "@/features/cart/lib/cart";

const address = {
  fullName: "Asha Menon",
  email: "asha@example.com",
  phone: "+91 90000 00000",
  addressLine1: "1 Test Road",
  city: "Mumbai",
  state: "MH",
  pincode: "400001",
};

function line(overrides: Partial<CartLineItem> = {}): CartLineItem {
  return {
    id: "line-1",
    productSlug: "black-forest",
    name: "Black Forest",
    image: "",
    price: 500,
    quantity: 1,
    ...overrides,
  };
}

function checkout(overrides: Partial<Parameters<typeof placeOrder>[0]> = {}) {
  const items = [line()];
  return placeOrder({
    items,
    totals: calculateCartTotals({ items, commerceOverride: defaultCommerceSettings }),
    address,
    paymentMethod: "razorpay",
    paymentStatus: "paid",
    paymentReference: "pay_test_1",
    ...overrides,
  });
}

type Answer =
  | { ok: boolean; status: number; data?: unknown; message?: string }
  | "network-error";

/** A fetch stub that answers each call with the next entry, then repeats the last. */
function respond(...answers: Answer[]) {
  let call = 0;
  const fetchMock = vi.fn().mockImplementation(() => {
    const answer = answers[Math.min(call, answers.length - 1)];
    call += 1;
    if (answer === "network-error") return Promise.reject(new Error("offline"));
    return Promise.resolve({
      ok: answer.ok,
      status: answer.status,
      json: () =>
        Promise.resolve({
          success: answer.ok,
          data: answer.data ?? null,
          // What a refused write actually answers with. The shop's reason lives
          // here, and it is the difference between "retry this" and "stop".
          ...(answer.message ? { message: answer.message } : {}),
        }),
    } as Response);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The body of the Nth POST this test made. */
function bodyOf(fetchMock: ReturnType<typeof respond>, call = 0) {
  return JSON.parse(fetchMock.mock.calls[call][1].body as string);
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Runs the promise with the retry backoff fast-forwarded. */
async function settle<T>(work: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return work;
}

describe("placing an order", () => {
  it("reports persisted when the server created it", async () => {
    respond({ ok: true, status: 201 });

    const { order, persisted } = await settle(checkout());

    expect(persisted).toBe(true);
    expect(order.orderNumber).toMatch(/^BK-/);
  });

  it("reports NOT persisted when the server never accepted it", async () => {
    respond({ ok: false, status: 500 });

    const { order, persisted } = await settle(checkout());

    expect(persisted).toBe(false);
    // The local write is deliberately kept — it is the only copy of a paid
    // order, and the retry path needs it. What must not happen is the caller
    // being told this succeeded.
    expect(getOrders()).toHaveLength(1);
    expect(order.paymentReference).toBe("pay_test_1");
  });

  it("survives a transient failure instead of losing a paid order", async () => {
    const fetchMock = respond("network-error", { ok: false, status: 503 }, { ok: true, status: 201 });

    const { persisted } = await settle(checkout());

    expect(persisted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("gives up after the third attempt rather than hanging on the customer", async () => {
    const fetchMock = respond({ ok: false, status: 500 });

    const { persisted } = await settle(checkout());

    expect(persisted).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does not retry a rejection the server will repeat", async () => {
    // A 400 means this payload is wrong; sending it twice more only makes the
    // customer wait through the backoff for the same answer.
    const fetchMock = respond({ ok: false, status: 400 });

    const { persisted } = await settle(checkout());

    expect(persisted).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("adopts the order number the server actually stored", async () => {
    // The browser picks its own order number, de-duplicated only against its OWN
    // history — the function's comment puts a clash at ~43% after 100 orders, and
    // `orderNumber` is uniquely indexed. So the server regularly has to issue a
    // different one. Whatever it stored is what appears on the invoice, in the
    // admin list and on the tracking page; a customer holding the number this
    // browser proposed would be holding a number that matches no order.
    const stored = { id: "will-be-replaced", orderNumber: "BK-20260730-9999" };
    respond({ ok: true, status: 201, data: stored });

    const { order, persisted } = await settle(checkout());

    expect(persisted).toBe(true);
    expect(order.orderNumber).toBe("BK-20260730-9999");
    // And the local cache agrees, so the tracking page finds the same order.
    expect(getOrders()[0].orderNumber).toBe("BK-20260730-9999");
    expect(getOrders()).toHaveLength(1);
  });

  it("keeps its own copy when the server echoes the same number back", async () => {
    respond({ ok: true, status: 201, data: null });

    const { order, persisted } = await settle(checkout());

    expect(persisted).toBe(true);
    expect(order.orderNumber).toMatch(/^BK-/);
    expect(getOrders()).toHaveLength(1);
  });

  it("re-sends the same order however long the customer took to press retry", async () => {
    respond({ ok: false, status: 500 });
    const first = await settle(checkout());
    expect(first.persisted).toBe(false);

    // The overlay asks the customer to note their payment reference down before
    // navigating away, so this pause is the NORMAL case, not an edge case. It
    // outlasts the 15s double-click window — and that window must not be what
    // the retry relies on, because past it `placeOrder` mints a fresh id and the
    // endpoint (which dedupes on the id) would create a SECOND order and
    // decrement stock twice for one payment.
    await vi.advanceTimersByTimeAsync(45_000);

    const fetchMock = respond({ ok: true, status: 201 });
    const { persisted } = await settle(confirmOrder(first.order));

    expect(persisted).toBe(true);
    expect(getOrders()).toHaveLength(1);

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent.id).toBe(first.order.id);
    expect(sent.orderNumber).toBe(first.order.orderNumber);
    expect(sent.paymentReference).toBe("pay_test_1");
  });

  it("re-sends the SAME order when the customer retries, never a second one", async () => {
    respond({ ok: false, status: 500 });
    const first = await settle(checkout());
    expect(first.persisted).toBe(false);

    // The customer presses the button again — usually BECAUSE the first attempt
    // failed. The duplicate guard must not swallow that as "already placed".
    const fetchMock = respond({ ok: true, status: 201 });
    const second = await settle(checkout());

    expect(second.persisted).toBe(true);
    expect(second.order.id).toBe(first.order.id);
    expect(second.order.orderNumber).toBe(first.order.orderNumber);
    expect(getOrders()).toHaveLength(1);

    // Same identity on the wire, so the idempotent endpoint recognises it.
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(sent.id).toBe(first.order.id);
    expect(sent.orderNumber).toBe(first.order.orderNumber);
  });
});

/**
 * The retry, once the card has already been charged.
 *
 * The shop will not place a card payment against a cart it did not price —
 * `order.service.ts`: "This cart needs to be priced again before payment", a
 * 409. So a retry that forgets the draft id is not merely less efficient, it is
 * refused, permanently, and the customer is left pressing a button that can
 * never work while holding a receipt for a cake nobody is baking.
 */
describe("re-sending an order the server never acknowledged", () => {
  it("sends the priced cart with it, so the shop can accept a paid order", async () => {
    respond({ ok: false, status: 500 });
    const first = await settle(checkout({ draftId: "draft_abc" }));
    expect(first.persisted).toBe(false);

    const fetchMock = respond({ ok: true, status: 201 });
    const { persisted } = await settle(confirmOrder(first.order, "draft_abc"));

    expect(persisted).toBe(true);
    expect(
      bodyOf(fetchMock).draftId,
      "the retry dropped the draft id, so the shop refuses the paid order",
    ).toBe("draft_abc");
  });

  it("keeps the priced cart when the customer just presses Place order again", async () => {
    respond({ ok: false, status: 500 });
    const first = await settle(checkout({ draftId: "draft_abc" }));
    expect(first.persisted).toBe(false);

    // Inside the duplicate window, so this goes down the re-send path rather
    // than minting a new order. That path dropped the draft id too.
    const fetchMock = respond({ ok: true, status: 201 });
    const second = await settle(checkout({ draftId: "draft_abc" }));

    expect(second.order.id).toBe(first.order.id);
    expect(
      bodyOf(fetchMock).draftId,
      "the duplicate-window re-send dropped the draft id",
    ).toBe("draft_abc");
  });

  it("reports the shop's own refusal instead of calling it an unreachable bakery", async () => {
    respond({ ok: false, status: 500 });
    const first = await settle(checkout({ draftId: "draft_abc" }));

    // 409 — answered, instantly, and it will be answered the same way next time.
    const fetchMock = respond({
      ok: false,
      status: 409,
      message: "This cart needs to be priced again before payment. Please refresh and retry.",
    });
    const { persisted, refusal } = await settle(confirmOrder(first.order, "draft_abc"));

    expect(persisted).toBe(false);
    // Without this the customer is told the network failed and invited to retry
    // something the server has already decided about.
    expect(refusal).toBe(
      "This cart needs to be priced again before payment. Please refresh and retry.",
    );
    // And it is not retried three times on the way to saying so.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("leaves the refusal empty when the request genuinely never got an answer", async () => {
    // The distinction is the whole point: no answer IS worth retrying, and must
    // not be dressed up in a reason the shop never gave.
    respond("network-error");
    const first = await settle(checkout({ draftId: "draft_abc" }));

    expect(first.persisted).toBe(false);
    expect(first.refusal).toBeUndefined();
  });
});
