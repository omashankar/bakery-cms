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
  amount: number; // rupees
  receipt: string;
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

let scriptPromise: Promise<boolean> | null = null;

function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${CHECKOUT_SCRIPT}"]`
    );
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      if (window.Razorpay) resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  return scriptPromise;
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
    body: JSON.stringify({ amount: options.amount, receipt: options.receipt }),
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
      name: options.brandName || "Monginis",
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
