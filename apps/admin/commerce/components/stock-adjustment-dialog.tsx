"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminSelect, adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { StockStatusBadge } from "@/apps/admin/commerce/components/stock-status-badge";
import {
  adjustStock,
  getInventorySettings,
  type AdjustStockInput,
} from "@/apps/admin/commerce/lib/inventory-repository";
import { deriveStockStatus } from "@/features/inventory/lib/inventory-utils";
import type { InventoryItem } from "@/types/inventory";
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
import { reportedAsSignedOut } from "@/apps/admin/lib/report-write";
import { useBusinessLabels } from "@/hooks/use-business-labels";

interface StockAdjustmentDialogProps {
  item: InventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdjusted?: () => void;
}

export function StockAdjustmentDialog({
  item,
  open,
  onOpenChange,
  onAdjusted,
}: StockAdjustmentDialogProps) {
  const labels = useBusinessLabels();
  const [type, setType] = useState<AdjustStockInput["type"]>("add");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<AdjustStockInput["reason"]>("manual_adjustment");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType("add");
    setQuantity("1");
    setReason("manual_adjustment");
    setNote("");
  }, [open, item?.cakeId]);

  const preview = useMemo(() => {
    if (!item) return null;

    const amount = Math.max(Number(quantity) || 0, 0);
    let nextQuantity = item.stockQuantity;

    if (type === "add") nextQuantity = item.stockQuantity + amount;
    if (type === "remove") nextQuantity = Math.max(item.stockQuantity - amount, 0);
    if (type === "set") nextQuantity = amount;

    const settings = getInventorySettings();
    const stockStatus = deriveStockStatus(
      {
        stockQuantity: nextQuantity,
        unlimitedStock: false,
        lowStockThreshold: item.lowStockThreshold,
      },
      settings
    );

    return { nextQuantity, stockStatus };
  }, [item, quantity, type]);

  async function handleSubmit() {
    // "Remove 5" is a RELATIVE delta, applied relatively on both sides. A second
    // click while the first round trip is in flight takes 5 off again, locally
    // and on the server — the admin meant one adjustment and got two. The button
    // is still enabled during the await, so this guard is what stops it.
    if (!item || submitting) return;

    const parsedQuantity = Math.max(Number(quantity) || 0, 0);
    if (parsedQuantity <= 0 && type !== "set") {
      toast.error("Enter a quantity greater than zero");
      return;
    }

    setSubmitting(true);
    const { item: updated, persisted } = await adjustStock({
      cakeId: item.cakeId,
      type,
      quantity: parsedQuantity,
      reason,
      note: note.trim() || undefined,
    });
    setSubmitting(false);

    if (!updated) {
      /**
       * THIS is the branch a refused write reaches.
       *
       * `adjustStock` answers `{ item: null, persisted: false }` for every
       * failure — it never returns an item alongside `persisted: false` — so
       * the guarded `!persisted` branch below cannot fire, and the guard was
       * sitting on the one path that does not happen while this one, the path
       * that does, said "Could not update stock" for a session that had ended.
       */
      if (!reportedAsSignedOut()) toast.error("Could not update stock");
      return;
    }

    if (!persisted) {
      // Stock is what the storefront sells against, and that number lives on the
      // server. Saying "updated" here would leave the shop selling a cake the
      // admin believes they have taken off the shelf.
      //
      // Close the dialog rather than leaving the same delta loaded: pressing
      // Save again would apply it to the ALREADY-adjusted local copy while the
      // server applied it to the untouched one, so a "successful" retry would
      // end with the two further apart than before, and the toast would quote
      // the local number.
      if (!reportedAsSignedOut()) toast.error("Stock changed on this device only — the server rejected it", {
        description: "The shop is still selling against the old count. Reload and try again.",
      });
      onOpenChange(false);
      onAdjusted?.();
      return;
    }

    toast.success("Stock updated", {
      description: `${item.name} is now ${updated.unlimitedStock ? "unlimited" : `${updated.stockQuantity} units`}`,
    });
    onOpenChange(false);
    onAdjusted?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {item ? `Update inventory for ${item.name}.` : `Select a ${labels.productWord.toLowerCase()} to adjust stock.`}
          </DialogDescription>
        </DialogHeader>

        {item ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-muted-foreground">
                    Current: {item.unlimitedStock ? "Unlimited" : `${item.stockQuantity} units`}
                  </p>
                </div>
                <StockStatusBadge
                  status={item.stockStatus}
                  unlimited={item.unlimitedStock}
                  quantity={item.stockQuantity}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="adjustment-type">Adjustment type</Label>
                <AdminSelect
                  id="adjustment-type"
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as AdjustStockInput["type"])
                  }
                >
                  <option value="add">Add stock</option>
                  <option value="remove">Remove stock</option>
                  <option value="set">Set exact quantity</option>
                </AdminSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjustment-quantity">Quantity</Label>
                <Input
                  id="adjustment-quantity"
                  type="number"
                  min={0}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment-reason">Reason</Label>
              <AdminSelect
                id="adjustment-reason"
                value={reason ?? "manual_adjustment"}
                onChange={(event) =>
                  setReason(event.target.value as AdjustStockInput["reason"])
                }
              >
                <option value="manual_adjustment">Manual adjustment</option>
                <option value="restock">Restock</option>
                <option value="correction">Correction</option>
                <option value="sale">Sale</option>
                <option value="return">Return</option>
              </AdminSelect>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adjustment-note">Note (optional)</Label>
              <textarea
                id="adjustment-note"
                className={adminTextareaClassName}
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Internal note for stock history…"
              />
            </div>

            {preview ? (
              <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2 text-sm">
                <span className="text-muted-foreground">After adjustment</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{preview.nextQuantity} units</span>
                  <StockStatusBadge status={preview.stockStatus} />
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="bakery"
            onClick={() => void handleSubmit()}
            disabled={!item || submitting}
          >
            Save adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
