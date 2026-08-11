"use client";

import { useState } from "react";
import { Loader2, Tag as TagIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  applyCouponCode,
  getCouponHint,
  type AppliedCoupon,
} from "@/features/orders/lib/coupons";

interface CouponInputProps {
  subtotal: number;
  applied?: AppliedCoupon;
  /**
   * Why the applied coupon no longer holds for this cart, when it does not.
   *
   * A coupon is checked against the cart it was applied to, and carts get
   * edited: remove a cake and a "₹200 off orders over ₹1,500" stops applying.
   * The discount vanished from the totals and the chip below carried on saying
   * the coupon was applied, in green, with the saving in brackets.
   */
  lapsedReason?: string | null;
  onApply: (coupon: AppliedCoupon) => void;
  onRemove: () => void;
}

export function CouponInput({
  subtotal,
  applied,
  lapsedReason,
  onApply,
  onRemove,
}: CouponInputProps) {
  const [code, setCode] = useState(applied?.code ?? "");
  const [loading, setLoading] = useState(false);

  async function handleApply() {
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const result = applyCouponCode(code, subtotal);
    setLoading(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    onApply(result.coupon);
    toast.success("Coupon applied", { description: result.coupon.label });
  }

  if (applied && lapsedReason) {
    // Amber, not green, and it says what happened. The discount is already gone
    // from the totals; this is the only thing on the page that admits it.
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2 text-amber-900">
          <TagIcon className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-medium">{applied.code} no longer applies</p>
            <p className="text-amber-800">{lapsedReason}</p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0 self-end sm:self-auto" onClick={onRemove}>
          Remove
        </Button>
      </div>
    );
  }

  if (applied) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-green-800">
          <TagIcon className="size-4 shrink-0" />
          <span className="truncate font-medium">{applied.code}</span>
          <span className="truncate text-green-700">({applied.label})</span>
        </div>
        <Button type="button" variant="ghost" size="sm" className="shrink-0 self-end sm:self-auto" onClick={onRemove}>
          Remove
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          placeholder="Coupon code"
          className="uppercase"
        />
        <Button type="button" variant="outline" onClick={handleApply} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">{getCouponHint()}</p>
    </div>
  );
}
