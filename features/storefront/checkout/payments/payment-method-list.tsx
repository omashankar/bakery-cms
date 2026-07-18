"use client";

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
        No payment methods are available right now. Please contact us and we will
        take your order directly.
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
