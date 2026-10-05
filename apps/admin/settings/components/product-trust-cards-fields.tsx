"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PRODUCT_TRUST_ICONS,
  PRODUCT_TRUST_ICON_LABELS,
  productTrustIcon,
} from "@/config/product-trust-icons";
import type { ProductTrustCard } from "@/types/settings";

interface ProductTrustCardsFieldsProps {
  value: ProductTrustCard[];
  onChange: (cards: ProductTrustCard[]) => void;
}

/**
 * The row of cards under every product photo.
 *
 * The reference storefront shows three — "100% Purchase Protection / Assured
 * Quality Secure Payments", "Serving Excellence / 20M Happy Customers + 100%
 * Satisfaction!", "Timely Delivery / Different Time Slots Available". Every one
 * of them is a claim, and two are numbers this software cannot know, so the row
 * was two cards hard-coded into the page instead.
 *
 * One of those two survives in the page and is not editable here: "Timely
 * Delivery" reads the shop's own `deliveryLeadDays`, so it says "Same-day
 * delivery" or "Next-day delivery" and cannot go stale. The other was two
 * English sentences a shop selling anything but cake could not change.
 *
 * Rows are keyed by their own id rather than by index, so editing one card does
 * not remount the field the cursor is in.
 */
export function ProductTrustCardsFields({ value, onChange }: ProductTrustCardsFieldsProps) {
  const iconNames = Object.keys(PRODUCT_TRUST_ICONS);

  function patch(id: string, change: Partial<ProductTrustCard>) {
    onChange(value.map((card) => (card.id === id ? { ...card, ...change } : card)));
  }

  function add() {
    onChange([
      ...value,
      {
        id: `card-${crypto.randomUUID().slice(0, 8)}`,
        icon: iconNames[0] ?? "BadgeCheck",
        title: "",
        subtitle: "",
      },
    ]);
  }

  function remove(id: string) {
    onChange(value.filter((card) => card.id !== id));
  }

  /** Order is what the customer reads, so it has to be the shop's to set. */
  function move(index: number, by: -1 | 1) {
    const next = [...value];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Label>Cards under the product photo</Label>
          <p className="text-xs text-muted-foreground">
            Say what your shop is like — how you pack, how you pay, how you
            deliver. Shown on every product page.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={value.length >= 6}
        >
          <Plus className="size-4" />
          Add card
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted px-4 py-6 text-center text-sm text-muted-foreground">
          No cards yet. The product page still shows your delivery speed, which
          it reads from the lead time above — add a card to say anything else.
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((card, index) => {
            const Icon = productTrustIcon(card.icon);
            return (
              <div
                key={card.id}
                className="grid gap-3 rounded-lg border border-border px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1.3fr)_auto]"
              >
                <div className="space-y-1">
                  <Label htmlFor={`card-icon-${card.id}`}>Icon</Label>
                  <div className="flex items-center gap-2">
                    <Icon className="size-5 shrink-0 text-bakery-700" aria-hidden />
                    <select
                      id={`card-icon-${card.id}`}
                      className="h-8 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      value={card.icon}
                      onChange={(event) => patch(card.id, { icon: event.target.value })}
                    >
                      {iconNames.map((name) => (
                        <option key={name} value={name}>
                          {PRODUCT_TRUST_ICON_LABELS[name] ?? name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`card-title-${card.id}`}>Title</Label>
                  <Input
                    id={`card-title-${card.id}`}
                    value={card.title}
                    onChange={(event) => patch(card.id, { title: event.target.value })}
                    placeholder="Secure payments"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`card-subtitle-${card.id}`}>Line under it</Label>
                  <Input
                    id={`card-subtitle-${card.id}`}
                    value={card.subtitle}
                    onChange={(event) => patch(card.id, { subtitle: event.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="flex items-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                    aria-label={`Move ${card.title || "card"} up`}
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={index === value.length - 1}
                    onClick={() => move(index, 1)}
                    aria-label={`Move ${card.title || "card"} down`}
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(card.id)}
                    aria-label={`Remove ${card.title || "card"}`}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            A card with no title is not saved. Leave the second line blank if the
            title says it all.
          </p>
        </div>
      )}
    </div>
  );
}
