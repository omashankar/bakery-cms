"use client";

import { useState } from "react";
import {
  Banknote,
  Building2,
  ChevronDown,
  CreditCard,
  Smartphone,
  Wallet,
} from "lucide-react";
import type { CheckoutMethod } from "@/features/payments/registry/methods";
import { PaymentBrandStrip } from "@/features/payments/components/payment-brand-strip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ICONS = { CreditCard, Banknote, Smartphone, Wallet, Building2 };

interface PaymentMethodCardProps {
  method: CheckoutMethod;
  selected: boolean;
  onSelect: (id: string) => void;
}

export function PaymentMethodCard({ method, selected, onSelect }: PaymentMethodCardProps) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[method.iconKey];

  return (
    <div
      className={cn(
        "rounded-xl border bg-white transition-colors",
        selected ? "border-bakery-700 ring-1 ring-bakery-700/20" : "border-border hover:border-bakery-300"
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(method.id)}
        aria-pressed={selected}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        {/* Radio indicator */}
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
            selected ? "border-bakery-700" : "border-muted-foreground/40"
          )}
        >
          {selected ? <span className="size-2.5 rounded-full bg-bakery-700" /> : null}
        </span>

        {/* Icon */}
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            selected ? "bg-bakery-700 text-white" : "bg-cream-100 text-bakery-700"
          )}
        >
          <Icon className="size-5" />
        </span>

        {/* Body */}
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{method.name}</span>
            {method.recommended ? (
              <Badge variant="accent" className="text-[10px]">Recommended</Badge>
            ) : null}
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">
            {method.description}
          </span>
          {method.brands?.length ? (
            <PaymentBrandStrip brands={method.brands} className="mt-2" />
          ) : null}
        </span>

        {/* Processing time */}
        <span className="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
          {method.processingTime}
        </span>
      </button>

      {method.details?.length ? (
        <div className="border-t border-border px-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-center justify-between py-2.5 text-xs font-medium text-bakery-700"
          >
            {open ? "Hide details" : "View details"}
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
          {open ? (
            <ul className="space-y-1.5 pb-4 text-sm text-muted-foreground">
              {method.details.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-gold" />
                  {line}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
