"use client";

import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { AdminSelect } from "@/features/admin/cakes/components/admin-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCoupon, loadCoupons, updateCoupon } from "../lib/coupons-repository";

type CouponFormValues = {
  code: string;
  label: string;
  description: string;
  discountType: "percent" | "flat";
  percentOff: string;
  flatOff: string;
  minSubtotal: string;
  expiresAt: string;
  isActive: boolean;
};

const emptyValues: CouponFormValues = {
  code: "",
  label: "",
  description: "",
  discountType: "percent",
  percentOff: "10",
  flatOff: "",
  minSubtotal: "",
  expiresAt: "",
  isActive: true,
};

interface CouponFormDialogProps {
  open: boolean;
  editingId: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function CouponFormDialog({
  open,
  editingId,
  onOpenChange,
  onSaved,
}: CouponFormDialogProps) {
  const editingCoupon = useMemo(
    () => (editingId ? loadCoupons().find((coupon) => coupon.id === editingId) ?? null : null),
    [editingId, open]
  );

  const { register, handleSubmit, reset, watch, formState } = useForm<CouponFormValues>({
    defaultValues: emptyValues,
  });

  const discountType = watch("discountType");

  useEffect(() => {
    if (!open) return;

    if (editingCoupon) {
      reset({
        code: editingCoupon.code,
        label: editingCoupon.label,
        description: editingCoupon.description,
        discountType: editingCoupon.percentOff ? "percent" : "flat",
        percentOff: editingCoupon.percentOff?.toString() ?? "",
        flatOff: editingCoupon.flatOff?.toString() ?? "",
        minSubtotal: editingCoupon.minSubtotal?.toString() ?? "",
        expiresAt: editingCoupon.expiresAt?.slice(0, 10) ?? "",
        isActive: editingCoupon.isActive,
      });
      return;
    }

    reset(emptyValues);
  }, [open, editingCoupon, reset]);

  const onSubmit = handleSubmit((values) => {
    const payload = {
      code: values.code,
      label: values.label,
      description: values.description,
      minSubtotal: values.minSubtotal ? Number(values.minSubtotal) : undefined,
      percentOff: values.discountType === "percent" ? Number(values.percentOff) : undefined,
      flatOff: values.discountType === "flat" ? Number(values.flatOff) : undefined,
      expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : undefined,
      isActive: values.isActive,
    };

    try {
      if (editingCoupon) {
        updateCoupon(editingCoupon.id, payload);
        toast.success("Coupon updated");
      } else {
        createCoupon(payload);
        toast.success("Coupon created");
      }
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save coupon");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingCoupon ? "Edit coupon" : "Add coupon"}</DialogTitle>
          <DialogDescription>
            Coupon codes are applied at checkout. Use uppercase codes for consistency.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="coupon-code">Code</Label>
              <Input id="coupon-code" {...register("code", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-label">Badge label</Label>
              <Input id="coupon-label" {...register("label", { required: true })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coupon-description">Description</Label>
            <Textarea id="coupon-description" {...register("description", { required: true })} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="discount-type">Discount type</Label>
              <AdminSelect id="discount-type" {...register("discountType")}>
                <option value="percent">Percentage</option>
                <option value="flat">Flat amount</option>
              </AdminSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="discount-value">
                {discountType === "percent" ? "Percent off" : "Flat off (₹)"}
              </Label>
              <Input
                id="discount-value"
                type="number"
                min="1"
                {...register(discountType === "percent" ? "percentOff" : "flatOff", {
                  required: true,
                })}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="min-subtotal">Minimum subtotal (optional)</Label>
              <Input id="min-subtotal" type="number" min="0" {...register("minSubtotal")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expires-at">Expiry date (optional)</Label>
              <Input id="expires-at" type="date" {...register("expiresAt")} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register("isActive")} />
            Active on storefront
          </label>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="bakery" disabled={formState.isSubmitting}>
              {editingCoupon ? "Save changes" : "Create coupon"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
