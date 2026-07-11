"use client";

import { useState } from "react";
import { Loader2, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  applyCouponCode,
  getCouponHint,
  type AppliedCoupon,
} from "@/features/storefront/checkout/lib/coupons";

interface CouponInputProps {
  subtotal: number;
  applied?: AppliedCoupon;
  onApply: (coupon: AppliedCoupon) => void;
  onRemove: () => void;
}

export function CouponInput({ subtotal, applied, onApply, onRemove }: CouponInputProps) {
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

  if (applied) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2 text-green-800">
          <Tag className="size-4 shrink-0" />
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
