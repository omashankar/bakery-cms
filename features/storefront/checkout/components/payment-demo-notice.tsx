"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";

/**
 * Payment mode notice.
 *
 * This used to state flatly that "no real money is charged" — but the Razorpay
 * integration is real, with server-side order creation and signature
 * verification. With live keys that sentence is false, and telling a customer
 * their card was not charged when it was is the kind of claim that ends in a
 * chargeback. The notice now reflects the gateway's actual mode, and says
 * nothing at all once payments are live.
 */
type PaymentMode = "unknown" | "test" | "live" | "unconfigured";

export function PaymentDemoNotice() {
  const [mode, setMode] = useState<PaymentMode>("unknown");

  useEffect(() => {
    let cancelled = false;

    async function loadMode() {
      try {
        const response = await fetch("/api/razorpay/config");
        const status = await response.json();
        if (cancelled) return;
        if (!status?.configured) setMode("unconfigured");
        else setMode(status.testMode ? "test" : "live");
      } catch {
        // Unknown stays unknown — better to show nothing than to guess wrong.
        if (!cancelled) setMode("unknown");
      }
    }

    void loadMode();
    return () => {
      cancelled = true;
    };
  }, []);

  // Live payments (or an unknown state) get no claim about money at all.
  if (mode === "unknown" || mode === "live") return null;

  return (
    <div className="flex items-start gap-2 rounded-xl border border-border bg-cream-100 p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-bakery-700" />
      <p>
        {mode === "test"
          ? "Test mode — your card will not be charged. Use Razorpay test card details to complete this order."
          : "Online payment is not connected yet. Choose Cash on Delivery to place your order."}
      </p>
    </div>
  );
}
