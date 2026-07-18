"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductDetails } from "@/types/product";
import { adminTextareaClassName } from "./admin-field";

interface ProductDetailsFieldsProps {
  value: ProductDetails & { ingredients?: string };
  onChange: (patch: Partial<ProductDetails & { ingredients?: string }>) => void;
}

export function ProductDetailsFields({ value, onChange }: ProductDetailsFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="barcode">Barcode / SKU</Label>
          <Input
            id="barcode"
            value={value.barcode ?? ""}
            onChange={(event) => onChange({ barcode: event.target.value })}
            placeholder="CAKE-CHOC-1KG"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="preparationTimeMinutes">Preparation time (minutes)</Label>
          <Input
            id="preparationTimeMinutes"
            type="number"
            min={0}
            value={value.preparationTimeMinutes ?? ""}
            onChange={(event) =>
              onChange({
                preparationTimeMinutes: event.target.value
                  ? Math.max(Number(event.target.value) || 0, 0)
                  : undefined,
              })
            }
            placeholder="120"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shelfLifeDays">Shelf life (days)</Label>
          <Input
            id="shelfLifeDays"
            type="number"
            min={0}
            value={value.shelfLifeDays ?? ""}
            onChange={(event) =>
              onChange({
                shelfLifeDays: event.target.value
                  ? Math.max(Number(event.target.value) || 0, 0)
                  : undefined,
              })
            }
            placeholder="3"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="calories">Calories (per serving)</Label>
          <Input
            id="calories"
            type="number"
            min={0}
            value={value.calories ?? ""}
            onChange={(event) =>
              onChange({
                calories: event.target.value
                  ? Math.max(Number(event.target.value) || 0, 0)
                  : undefined,
              })
            }
            placeholder="320"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ingredients">Ingredients</Label>
        <textarea
          id="ingredients"
          className={adminTextareaClassName}
          value={value.ingredients ?? ""}
          onChange={(event) => onChange({ ingredients: event.target.value })}
          placeholder="Flour, sugar, cocoa, butter..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="allergens">Allergens</Label>
        <textarea
          id="allergens"
          className={adminTextareaClassName}
          value={value.allergens ?? ""}
          onChange={(event) => onChange({ allergens: event.target.value })}
          placeholder="Contains milk, wheat, nuts..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="careInstructions">Cake care instructions</Label>
        <textarea
          id="careInstructions"
          className={adminTextareaClassName}
          value={value.careInstructions ?? ""}
          onChange={(event) => onChange({ careInstructions: event.target.value })}
          placeholder="Refrigerate within 2 hours. Serve at room temperature..."
        />
      </div>
    </div>
  );
}
