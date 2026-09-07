"use client";

import { Label } from "@/components/ui/label";
import type { ProductDetails } from "@/types/product";
import { adminTextareaClassName } from "./admin-field";

/*
  SIX FIELDS STOOD HERE, and the shop asked for every one of them.

  Barcode / SKU, Preparation time, Shelf life, Calories, Ingredients and
  Allergens. None of them drove any logic — no delivery date was computed from a
  preparation time, no stock was found by barcode, no order was stopped by an
  allergen. All six were display, and four of them printed a second time as a
  chip beside the product name.

  What the product page reads as now is the shop's own three headings: Product
  Details (whatever facts it types under "Add detail"), Delivery Information
  (written once in Settings → Commerce) and Care Instructions, which is what is
  left in this file.

  The shop was told plainly what dropping Allergens costs — it is the one field
  here where being wrong can hurt somebody — and asked for it anyway. It can
  still say so in the description or as a "Contains" line under Product details,
  which is the system this project already has for a shop's own facts.
*/
interface ProductDetailsFieldsProps {
  value: ProductDetails;
  onChange: (patch: Partial<ProductDetails>) => void;
}

export function ProductDetailsFields({ value, onChange }: ProductDetailsFieldsProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="careInstructions">Care instructions</Label>
      <textarea
        id="careInstructions"
        className={adminTextareaClassName}
        rows={5}
        value={value.careInstructions ?? ""}
        onChange={(event) => onChange({ careInstructions: event.target.value })}
        placeholder={
          "Refrigerate on arrival.\nServe at room temperature.\nEat within 24 hours."
        }
      />
      <p className="text-xs text-muted-foreground">
        One line per point. These show as a bulleted “Care Instructions” list on
        the product page.
      </p>
    </div>
  );
}
