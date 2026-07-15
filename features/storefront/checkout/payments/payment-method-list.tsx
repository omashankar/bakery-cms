"use client";

import { Bookmark } from "lucide-react";
import type { CheckoutMethod } from "@/features/payments/registry/methods";
import { PaymentMethodCard } from "@/features/storefront/checkout/payments/payment-method-card";

interface PaymentMethodListProps {
  methods: CheckoutMethod[];
  selected: string;
  onSelect: (id: string) => void;
}

export function PaymentMethodList({ methods, selected, onSelect }: PaymentMethodListProps) {
  if (methods.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        No payment methods are enabled. Ask the bakery to turn one on in Admin →
        Payments.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Saved methods — placeholder for a future logged-in wallet */}
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border bg-cream-50 px-4 py-3">
        <Bookmark className="size-4 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          No saved payment methods yet — they’ll appear here after your first online payment.
        </p>
      </div>

      {methods.map((method) => (
        <PaymentMethodCard
          key={method.id}
          method={method}
          selected={selected === method.id}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
