"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

import { formatCurrency } from "@/utils/format";

/**
 * Captured payments with no order behind them.
 *
 * These have always been possible — a customer's browser dying between the
 * gateway confirming and the shop recording it, a priced cart expiring before a
 * retried webhook lands, a payment taken before an address was entered. What was
 * missing was anywhere to SEE them: transactions are derived from orders, so a
 * payment without an order produced no row, and money that had gone missing
 * looked exactly like money that had never been sent.
 *
 * Deliberately loud and deliberately at the top of the Payments screen. Every
 * row here is a real customer who has paid and is waiting.
 */

interface UnclaimedPayment {
  id: string;
  amount: number;
  reason: string;
  customerEmail: string | null;
  customerPhone: string | null;
  noticedAt: string;
}

export function UnclaimedPaymentsAlert() {
  const [items, setItems] = useState<UnclaimedPayment[]>([]);
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payments/unclaimed")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items?: UnclaimedPayment[]; amount?: number } | null) => {
        if (cancelled || !data) return;
        setItems(data.items ?? []);
        setAmount(data.amount ?? 0);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-destructive">
            {items.length} payment{items.length === 1 ? "" : "s"} received with no order —{" "}
            {formatCurrency(amount)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            The money is in your gateway account. Each of these is a customer who has paid and has
            nothing to show for it — place the order by hand, or refund them.
          </p>
          <ul className="mt-3 space-y-2">
            {items.slice(0, 5).map((item) => (
              <li key={item.id} className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{formatCurrency(item.amount)}</span>
                  <span className="font-mono text-muted-foreground">{item.id}</span>
                </div>
                <p className="mt-1 text-muted-foreground">{item.reason}</p>
                {item.customerEmail || item.customerPhone ? (
                  <p className="mt-1 text-muted-foreground">
                    {[item.customerEmail, item.customerPhone].filter(Boolean).join(" · ")}
                  </p>
                ) : (
                  <p className="mt-1 text-muted-foreground">
                    No contact details — look this payment up in the Razorpay dashboard.
                  </p>
                )}
              </li>
            ))}
          </ul>
          {items.length > 5 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              …and {items.length - 5} more.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
