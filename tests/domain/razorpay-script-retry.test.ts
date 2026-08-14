/**
 * "Retry payment" has to be able to succeed.
 *
 * The gateway script's load outcome was memoised either way, so a single
 * failure — a dropped connection at the wrong second, a blocked request — was
 * the answer for the rest of the tab. Every later attempt got the cached
 * `false` without touching the network and threw "Payment gateway failed to
 * load. Check your connection." The connection was fine. The only way out of
 * the checkout was a full page reload, which nothing on screen suggested.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { openRazorpayCheckout, RazorpayError } from "@/apps/website/checkout/lib/razorpay";

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

/**
 * jsdom does not fetch scripts, so nothing ever fires load or error on its own.
 * This drives them by hand — `outcome` decides what happens to the NEXT script
 * the code under test appends.
 *
 * A successful load DEFINES `window.Razorpay`, here as in the real world, and
 * not a moment before. Setting it up front instead is how an earlier version of
 * this file passed against the bug: `loadRazorpayScript` short-circuits on
 * `window.Razorpay` before it ever consults the cache, so the test never
 * reached the thing it was written to check.
 */
let outcome: "load" | "error" = "error";

function driveScriptTags() {
  const realAppend = document.body.appendChild.bind(document.body);
  vi.spyOn(document.body, "appendChild").mockImplementation(((node: Node) => {
    const appended = realAppend(node);
    if (node instanceof HTMLScriptElement && node.src === CHECKOUT_SCRIPT) {
      queueMicrotask(() => {
        if (outcome === "load") {
          (window as { Razorpay?: unknown }).Razorpay = function Razorpay() {
            return { open: () => {}, on: () => {} };
          } as unknown;
        }
        node.dispatchEvent(new Event(outcome));
      });
    }
    return appended;
  }) as typeof document.body.appendChild);
}

/** The server half of the flow: creating the Razorpay order always succeeds. */
function stubOrderEndpoint() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({ keyId: "rzp_test", amount: 120000, currency: "INR", orderId: "order_1" }),
    } as Response),
  );
}

function attempt() {
  return openRazorpayCheckout({
    draftId: "draft_abc",
    name: "Asha Menon",
    email: "asha@example.com",
    phone: "9000000001",
  });
}

beforeEach(() => {
  outcome = "error";
  delete (window as { Razorpay?: unknown }).Razorpay;
  document.querySelectorAll(`script[src="${CHECKOUT_SCRIPT}"]`).forEach((node) => node.remove());
  stubOrderEndpoint();
  driveScriptTags();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the payment gateway script", () => {
  it("is loaded again after a failure, so Retry payment can work", async () => {
    await expect(attempt()).rejects.toBeInstanceOf(RazorpayError);

    // The connection comes back, and the customer presses Retry payment.
    // `window.Razorpay` is still undefined at this point — the script has to be
    // fetched again to define it, which is exactly what the cached failure
    // prevented.
    outcome = "load";
    expect((window as { Razorpay?: unknown }).Razorpay).toBeUndefined();

    // It gets as far as opening the modal, which is all this test claims: the
    // cached failure is no longer answering for the network.
    const opened = attempt();
    await expect(
      Promise.race([opened, new Promise((resolve) => setTimeout(() => resolve("pending"), 50))]),
    ).resolves.toBe("pending");
  });

  it("does not leave the failed script tag behind for the next attempt to wait on", async () => {
    await expect(attempt()).rejects.toBeInstanceOf(RazorpayError);

    // A script that has already errored never fires load or error again, so an
    // attempt that found it and attached listeners would hang forever — the
    // customer left on "Redirecting…" with no way out.
    expect(document.querySelectorAll(`script[src="${CHECKOUT_SCRIPT}"]`)).toHaveLength(0);
  });

  it("still fails when the gateway is genuinely unreachable", async () => {
    // The retry must re-attempt, not paper over a real outage.
    await expect(attempt()).rejects.toThrow(/failed to load/i);
    await expect(attempt()).rejects.toThrow(/failed to load/i);
  });
});
