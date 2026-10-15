"use client";

import { useState } from "react";
import { ChevronRight, Tag } from "lucide-react";

import { CouponInput } from "@/apps/website/checkout/components/coupon-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CartOffer } from "@/features/commerce/lib/coupon-offers";
import { applyCouponCode, type AppliedCoupon, type CouponCart } from "@/features/orders/lib/coupons";
import { toast } from "@/lib/lazy-toast";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";

/**
 * THE COUPON BOX, AS THE REFERENCE CART HAS IT: one quiet "Apply Coupons" row
 * beside the totals, opening a dialog with the code box and every offer as a
 * card priced against THIS basket. The cards used to sit in the main column
 * between the lines and the extras, a third of a screen of offers on the page
 * where the customer is checking what they are buying.
 *
 * Applied, the row is the applied code and a Remove — CouponInput's own state.
 */
export function CartCouponPanel({
  cart,
  applied,
  lapsedReason,
  offers,
  onApply,
  onRemove,
}: {
  cart: CouponCart;
  applied?: AppliedCoupon;
  lapsedReason?: string | null;
  offers: CartOffer[];
  onApply: (coupon: AppliedCoupon) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (applied) {
    return (
      // No frame of its own: the applied chip is already a box.
      <div>
        <CouponInput
          cart={cart}
          applied={applied}
          lapsedReason={lapsedReason}
          onApply={onApply}
          onRemove={onRemove}
        />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-bakery-300 bg-card px-4 py-3.5 text-left transition-colors hover:bg-cream-50"
      >
        <Tag className="size-5 shrink-0 text-bakery-700" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Apply Coupons</span>
          {offers.length > 0 ? (
            <span className="block text-xs text-muted-foreground">
              {offers.length} {offers.length === 1 ? "offer" : "offers"} for this order
            </span>
          ) : null}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="size-5 text-bakery-700" aria-hidden />
              Discount coupons
            </DialogTitle>
            <DialogDescription>Save more on your order.</DialogDescription>
          </DialogHeader>

          <CouponInput
            cart={cart}
            onApply={(coupon) => {
              onApply(coupon);
              setOpen(false);
            }}
            onRemove={onRemove}
          />

          {offers.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">Other coupons</p>
              <ul className="space-y-3">
                {offers.map((offer) => {
                  // Priced by the rule checkout runs, so "Save ₹X" is what this
                  // basket gets — not the label's headline.
                  const check = offer.shortfall > 0 ? null : applyCouponCode(offer.code, cart);
                  const saving = check?.ok ? check.coupon.discountAmount : 0;
                  return (
                    <li
                      key={offer.code}
                      className="flex flex-col gap-2 rounded-lg border border-border bg-cream-50 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-foreground">
                            {saving > 0 ? `Save ${formatCurrency(saving)}` : offer.label}
                          </p>
                          {saving > 0 ? (
                            <p className="text-xs text-muted-foreground">{offer.label}</p>
                          ) : null}
                        </div>
                        {check?.ok ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            onClick={() => {
                              onApply(check.coupon);
                              setOpen(false);
                              toast.success(`${check.coupon.code} applied`, {
                                description: `${formatCurrency(saving)} saved with this coupon`,
                              });
                            }}
                          >
                            Apply
                          </Button>
                        ) : null}
                      </div>
                      <span className="w-fit rounded border border-dashed border-border bg-card px-2 py-0.5 font-mono text-xs font-semibold tracking-wide">
                        {offer.code}
                      </span>
                      <p
                        className={cn(
                          "text-xs",
                          check?.ok ? "font-medium text-green-700" : "text-muted-foreground",
                        )}
                      >
                        {check?.ok
                          ? `You will save ${formatCurrency(saving)} with this code`
                          : offer.shortfall > 0
                            ? `Add ${formatCurrency(offer.shortfall)} more to use it`
                            : check && !check.ok
                              ? check.message
                              : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
