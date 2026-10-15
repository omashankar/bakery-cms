import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Razorpay pays refunds out of the account balance, and answers one the
 * balance cannot cover with a bare "invalid request sent". Measured on this
 * shop's test account: a ₹1,043 payment left ₹1,022.14 after Razorpay's fee,
 * so refunding it in full was refused with exactly that — and the admin was
 * shown "invalid request sent", which tells them nothing they can act on.
 */
const refund = vi.fn();

vi.mock("razorpay", () => ({
  default: class {
    payments = { refund };
  },
}));

vi.mock("@/lib/server/payments/razorpay-credentials", () => ({
  getRazorpayCredentials: async () => ({ keyId: "rzp_test_x", keySecret: "secret" }),
}));

const { createRazorpayRefund } = await import("@/features/payments/server/razorpay-refund.server");

function balanceOf(paise: number) {
  return vi.fn(async () =>
    new Response(JSON.stringify({ balance: paise, refund_credits: 0, currency: "INR" }), {
      status: 200,
    }),
  );
}

const ARGS = {
  paymentId: "pay_1",
  amount: 1043,
  receipt: "BK-1-R1",
  orderNumber: "BK-1",
  reason: "order_cancelled",
};

describe("a refund Razorpay refuses", () => {
  beforeEach(() => {
    refund.mockReset();
    refund.mockRejectedValue({
      statusCode: 400,
      error: { code: "BAD_REQUEST_ERROR", description: "invalid request sent" },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("names the balance when the balance is short", async () => {
    vi.stubGlobal("fetch", balanceOf(102_214));
    const outcome = await createRazorpayRefund(ARGS);
    expect(outcome.ok).toBe(false);
    expect(outcome.refused).toMatch(/Razorpay balance \(₹1,022\.14\) is less than this refund \(₹1,043\.00\)/);
  });

  it("keeps Razorpay's own words when the balance is not the reason", async () => {
    vi.stubGlobal("fetch", balanceOf(500_000));
    const outcome = await createRazorpayRefund(ARGS);
    expect(outcome.refused).toBe("invalid request sent");
  });

  it("keeps Razorpay's own words when the balance cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 401 })));
    const outcome = await createRazorpayRefund(ARGS);
    expect(outcome.refused).toBe("invalid request sent");
  });

  it("asks nothing extra when the refund goes through", async () => {
    const fetch = balanceOf(0);
    vi.stubGlobal("fetch", fetch);
    refund.mockResolvedValue({ id: "rfnd_1", status: "pending", amount: 104_300 });
    const outcome = await createRazorpayRefund(ARGS);
    expect(outcome.ok).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
