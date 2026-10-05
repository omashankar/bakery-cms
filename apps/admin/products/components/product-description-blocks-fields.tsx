"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductDescriptionBlock } from "@/types/product";
import { useBusinessLabels } from "@/hooks/use-business-labels";
import { adminTextareaClassName } from "./admin-field";

interface ProductDescriptionBlocksFieldsProps {
  value: ProductDescriptionBlock[];
  onChange: (blocks: ProductDescriptionBlock[]) => void;
  /**
   * The shop's delivery lines from Settings → Commerce, offered as a starting
   * draft rather than applied.
   *
   * It used to be printed on every product automatically, which is wrong the
   * moment a shop sells two kinds of thing: a cake goes out with the shop's own
   * driver and a phone charger goes by courier, and one text cannot be true of
   * both. Copying it into the product makes it the product's own words, which
   * the shop can then contradict on the one product that needs it.
   */
  deliveryInformation?: string;
}

/**
 * The product description, as any shop actually writes one.
 *
 * This replaced `attributes` — a list of {label, value} pairs under one fixed
 * "Product Details" heading, with `careInstructions` in a box of its own under
 * another. Six reference storefronts were read one by one and not one of them
 * fits that shape:
 *
 *   a cake     Product Details · Delivery Information · Care Instructions · Note
 *   a plant    (no heading) · Benefits · Disclaimer · Do's · Dont's
 *   a candle   (no heading) · Delivery Details · Care Directives
 *
 * Different headings, different counts, and two with no heading at all over the
 * first list. So a block is a heading and a body, the shop adds as many as it
 * likes, and neither the wording nor the number is decided here.
 *
 * Rows are keyed by their own id rather than by index, so editing one block does
 * not remount the field the cursor is in.
 */
export function ProductDescriptionBlocksFields({
  value,
  onChange,
  deliveryInformation,
}: ProductDescriptionBlocksFieldsProps) {
  const labels = useBusinessLabels();
  const productWord = labels.productWord.toLowerCase();

  const newId = () => `blk-${crypto.randomUUID().slice(0, 8)}`;

  function patch(id: string, change: Partial<ProductDescriptionBlock>) {
    onChange(value.map((block) => (block.id === id ? { ...block, ...change } : block)));
  }

  function add(heading = "", body = "") {
    onChange([...value, { id: newId(), heading, body }]);
  }

  function remove(id: string) {
    onChange(value.filter((block) => block.id !== id));
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{labels.descriptionHeading}</p>
          <p className="text-xs text-muted-foreground">
            Blocks shown on the {productWord} page. Give each one a heading and a
            line per point — Product Details, Delivery Information, Care
            Instructions, Do&rsquo;s, whatever this {productWord} needs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {deliveryInformation?.trim() ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => add("Delivery Information", deliveryInformation.trim())}
            >
              <Plus className="size-4" />
              Delivery from Settings
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => add()}>
            <Plus className="size-4" />
            Add block
          </Button>
        </div>
      </div>

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted px-4 py-8 text-center text-sm text-muted-foreground">
          No blocks yet. Add one to describe this {productWord} — a heading like
          &ldquo;Product Details&rdquo; and a line for each point under it.
        </div>
      ) : (
        <div className="space-y-3">
          {value.map((block, index) => (
            <div key={block.id} className="space-y-3 rounded-lg border border-border px-3 py-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label htmlFor={`blk-heading-${block.id}`}>Heading</Label>
                  <Input
                    id={`blk-heading-${block.id}`}
                    value={block.heading}
                    onChange={(event) => patch(block.id, { heading: event.target.value })}
                    placeholder="Product Details"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={`Move ${block.heading || "block"} up`}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={index === value.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={`Move ${block.heading || "block"} down`}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(block.id)}
                  aria-label={`Remove ${block.heading || "block"}`}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`blk-body-${block.id}`}>One line per point</Label>
                <textarea
                  id={`blk-body-${block.id}`}
                  className={adminTextareaClassName}
                  rows={5}
                  value={block.body}
                  onChange={(event) => patch(block.id, { body: event.target.value })}
                  placeholder={"Material: Wooden\nSize: 12 x 18 inches\nNet Quantity: 1 Unit"}
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Leave a heading blank to print the lines with no label over them.
          </p>
        </div>
      )}
    </div>
  );
}
