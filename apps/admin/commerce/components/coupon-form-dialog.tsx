"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { reportWrite } from "@/apps/admin/lib/report-write";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toExpiryInputValue, toExpiryInstant } from "@/lib/expiry-date";
import { createCoupon, loadCoupons, updateCoupon } from "@/features/commerce/lib/coupons-repository";
import { adminCategories } from "@/features/products/lib/catalog-options";

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
  /** Empty means the whole shop, which is what every coupon was until now. */
  categoryIds: string[];
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
  categoryIds: [],
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

  const { register, control, handleSubmit, reset, watch, formState } = useForm<CouponFormValues>({
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
        expiresAt: toExpiryInputValue(editingCoupon.expiresAt),
        isActive: editingCoupon.isActive,
        // `?? []` is not a default being invented: absent and empty both
        // mean the whole shop, and every coupon stored before scoping
        // existed reads back absent.
        categoryIds: editingCoupon.categoryIds ?? [],
      });
      return;
    }

    reset(emptyValues);
  }, [open, editingCoupon, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      code: values.code,
      label: values.label,
      description: values.description,
      minSubtotal: values.minSubtotal ? Number(values.minSubtotal) : undefined,
      percentOff: values.discountType === "percent" ? Number(values.percentOff) : undefined,
      flatOff: values.discountType === "flat" ? Number(values.flatOff) : undefined,
      // End of the chosen day, in the shop's timezone — see lib/expiry-date.ts.
      expiresAt: toExpiryInstant(values.expiresAt),
      isActive: values.isActive,
      categoryIds: values.categoryIds,
    };

    try {
      if (editingCoupon) {
        const { persisted } = await updateCoupon(editingCoupon.id, payload);
        reportWrite(persisted, "Coupon updated");
      } else {
        const { persisted } = await createCoupon(payload);
        reportWrite(persisted, "Coupon created");
      }
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save coupon");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
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
                max={discountType === "percent" ? "100" : undefined}
                {...register(discountType === "percent" ? "percentOff" : "flatOff", {
                  required: true,
                  ...(discountType === "percent" ? { max: 100 } : {}),
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

          {/*
            WHAT THIS CODE IS FOR — the control that stops a coupon being
            shop-wide.

            A shop selling cakes AND plants AND chargers could not run "20% off
            plants": the discount hit everything in the basket. Ticking nothing
            keeps the old behaviour exactly, which is why the heading says so
            rather than leaving an owner to infer it from an empty grid.

            Same control and same shape as the product form's "Also show it
            under", because it is the same question asked of the same list.
          */}
          {adminCategories().length > 0 ? (
            <Controller
              control={control}
              name="categoryIds"
              render={({ field }) => (
                <div className="space-y-2">
                  <Label>Applies to</Label>
                  <p className="text-xs text-muted-foreground">
                    Leave everything unticked and the code works on the whole shop.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {adminCategories().map((category) => (
                      <label
                        key={category.id}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={field.value.includes(category.id)}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked === true
                                ? [...field.value, category.id]
                                : field.value.filter((id: string) => id !== category.id),
                            )
                          }
                        />
                        {category.name}
                      </label>
                    ))}
                  </div>
                  {field.value.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      The discount applies to these items only — anything else in the
                      basket is charged in full, and a minimum subtotal is measured
                      against these items too.
                    </p>
                  ) : null}
                </div>
              )}
            />
          ) : null}

          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                Active on storefront
              </label>
            )}
          />

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
