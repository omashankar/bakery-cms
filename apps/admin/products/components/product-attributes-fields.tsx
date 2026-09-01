"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductAttribute } from "@/types/product";

interface ProductAttributesFieldsProps {
  value: ProductAttribute[];
  onChange: (attributes: ProductAttribute[]) => void;
}

/**
 * The shop's own facts about a product — Brand, Material, Warranty, RAM.
 *
 * Deliberately the SIMPLEST editor in the form: a label, a value, add, remove.
 * No price column, no default, no required tick. Those three are exactly what
 * make the Options tab a set of choices, and an attribute is not a choice —
 * it is true of the product whether or not anyone buys it. A shop that wanted
 * "Brand: Samsung" before this existed had to fake it as a one-option variant
 * group, which the product page then rendered as a button to tap and the order
 * line recorded as something the customer picked.
 *
 * Rows are keyed by their own id rather than by index, so editing one field
 * does not remount the row the cursor is in.
 */
export function ProductAttributesFields({ value, onChange }: ProductAttributesFieldsProps) {
  function patch(id: string, change: Partial<ProductAttribute>) {
    onChange(value.map((attribute) => (attribute.id === id ? { ...attribute, ...change } : attribute)));
  }

  function add() {
    onChange([
      ...value,
      { id: `attr-${crypto.randomUUID().slice(0, 8)}`, label: "", value: "" },
    ]);
  }

  function remove(id: string) {
    onChange(value.filter((attribute) => attribute.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Product details</p>
          <p className="text-xs text-muted-foreground">
            Facts you want shown on the product page — Brand, Material, Warranty,
            anything this product should state. Not a choice, and never priced.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="size-4" />
          Add detail
        </Button>
      </div>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
          No details yet. Add one to show a fact on the product page, like
          &ldquo;Brand: Samsung&rdquo; or &ldquo;Material: Ceramic&rdquo;.
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((attribute) => (
            <div
              key={attribute.id}
              className="grid gap-3 rounded-lg border border-border px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
            >
              <div className="space-y-1">
                <Label htmlFor={`attr-label-${attribute.id}`}>Name</Label>
                <Input
                  id={`attr-label-${attribute.id}`}
                  value={attribute.label}
                  onChange={(event) => patch(attribute.id, { label: event.target.value })}
                  placeholder="Brand"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`attr-value-${attribute.id}`}>Value</Label>
                <Input
                  id={`attr-value-${attribute.id}`}
                  value={attribute.value}
                  onChange={(event) => patch(attribute.id, { value: event.target.value })}
                  placeholder="Samsung"
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(attribute.id)}
                  aria-label={`Remove ${attribute.label || "detail"}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
