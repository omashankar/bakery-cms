"use client";

/**
 * Client-side Razorpay checkout helper.
 * Flow: create order on our server -> open Razorpay's hosted modal -> verify the
 * returned signature on our server -> resolve with the verified payment id.
 */

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpayResult {
  paymentId: string;
  orderId: string;
  signature: string;
}

interface OpenOptions {
  /**
   * The priced cart the SERVER holds.
   *
   * This used to be `amount` and `receipt` — the browser told the server what to
   * charge, so a 5000-rupee cart could be paid, genuinely and in full, at 1
   * rupee. The server now reads the total off the draft it priced itself.
   */
  draftId: string;
  name: string;
  email: string;
  phone: string;
  brandName?: string;
}

// Minimal shape of the Razorpay checkout global we rely on.
type RazorpayConstructor = new (options: Record<string, unknown>) => {
  open: () => void;
  on: (event: string, handler: (response: unknown) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

/**
 * Only a SUCCESSFUL load is remembered.
 *
 * This used to cache the outcome either way, so one failed load — a dropped
 * connection at the wrong second, a blocked request — was the answer for the
 * rest of the tab. "Retry payment" called back in, got the cached `false`
 * without touching the network, and threw "Payment gateway failed to load"
 * again. And again. The only way out of a checkout was a full page reload,
 * which nothing on screen suggested.
 */
let scriptPromise: Promise<boolean> | null = null;

/**
 * A gateway that never answers is a customer stuck on "Redirecting…".
 *
 * The `existing` branch below attaches a `load` listener to a script that may
 * have already finished — or already failed — and neither fires again. Without
 * a deadline that promise is simply never settled, and the await above it never
 * returns.
 */
const SCRIPT_LOAD_TIMEOUT_MS = 15_000;

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  const attempt = new Promise<boolean>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (ok: boolean, node?: HTMLScriptElement) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      // A script tag that failed stays in the DOM and matches the selector
      // below, so leaving it there would send the next attempt straight into
      // the `existing` branch to wait on events that have already fired.
      if (!ok) node?.remove();
      resolve(ok);
    };

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SCRIPT}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => finish(true));
      existing.addEventListener("error", () => finish(false, existing));
      if (window.Razorpay) finish(true);
      timer = setTimeout(() => finish(Boolean(window.Razorpay), existing), SCRIPT_LOAD_TIMEOUT_MS);
      return;
    }

    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => finish(true);
    script.onerror = () => finish(false, script);
    timer = setTimeout(() => finish(Boolean(window.Razorpay), script), SCRIPT_LOAD_TIMEOUT_MS);
    document.body.appendChild(script);
  });

  scriptPromise = attempt;
  void attempt.then((ok) => {
    if (!ok && scriptPromise === attempt) scriptPromise = null;
  });

  return attempt;
}

export class RazorpayError extends Error {}

/**
 * Opens the Razorpay checkout modal and resolves once the payment is completed
 * AND verified. Rejects if the user closes the modal or payment/verification fails.
 */
export async function openRazorpayCheckout(options: OpenOptions): Promise<RazorpayResult> {
  // 1. Create the order on our server (uses the secret key).
  const orderRes = await fetch("/api/razorpay/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draftId: options.draftId }),
  });
  const orderData = await orderRes.json();
  if (!orderRes.ok) {
    throw new RazorpayError(orderData?.error || "Could not start payment");
  }

  // 2. Load the hosted checkout script.
  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    throw new RazorpayError("Payment gateway failed to load. Check your connection.");
  }

  // 3. Open the modal and wait for the outcome.
  return new Promise<RazorpayResult>((resolve, reject) => {
    const RazorpayCtor = window.Razorpay!;
    const rzp = new RazorpayCtor({
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      order_id: orderData.orderId,
      // The shop's configured site name, not a hardcoded demo brand.
      //
      // `brandName` was declared in these options and never supplied by the one
      // caller, so every payment sheet was headed with the demo brand — a different
      // company from the storefront the customer is on, the invoice they get
      // and the confirmation they read. Nothing is misdirected (the merchant
      // account comes from the server's `keyId` and the signature is verified
      // there), but an unfamiliar name on a payment sheet is a reason to close
      // it. The caller reads the configured name; this fallback stands only if
      // it somehow arrives empty.
      name: options.brandName?.trim() || "Checkout",
      description: "Order payment",
      prefill: {
        name: options.name,
        email: options.email,
        contact: options.phone,
      },
      theme: { color: "#6F4E37" },
      modal: {
        ondismiss: () => reject(new RazorpayError("Payment cancelled")),
      },
      handler: async (response: unknown) => {
        const r = response as {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        };
        try {
          // 4. Verify the signature on our server.
          const verifyRes = await fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(r),
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok && verifyData.verified) {
            resolve({
              paymentId: r.razorpay_payment_id,
              orderId: r.razorpay_order_id,
              signature: r.razorpay_signature,
            });
          } else {
            reject(new RazorpayError("Payment could not be verified"));
          }
        } catch {
          reject(new RazorpayError("Payment verification failed"));
        }
      },
    });

    rzp.on("payment.failed", (response: unknown) => {
      const err = response as { error?: { description?: string } };
      reject(new RazorpayError(err?.error?.description || "Payment failed"));
    });

    rzp.open();
  });
}
