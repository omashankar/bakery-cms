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
import { deriveStockStatus } from "@/apps/admin/commerce/lib/inventory-utils";
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
  const [type, setType] = useState<AdjustStockInput["type"]>("add");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState<AdjustStockInput["reason"]>("manual_adjustment");
  const [note, setNote] = useState("");

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

  function handleSubmit() {
    if (!item) return;

    const parsedQuantity = Math.max(Number(quantity) || 0, 0);
    if (parsedQuantity <= 0 && type !== "set") {
      toast.error("Enter a quantity greater than zero");
      return;
    }

    const updated = adjustStock({
      cakeId: item.cakeId,
      type,
      quantity: parsedQuantity,
      reason,
      note: note.trim() || undefined,
    });

    if (!updated) {
      toast.error("Could not update stock");
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {item ? `Update inventory for ${item.name}.` : "Select a product to adjust stock."}
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
          <Button variant="bakery" onClick={handleSubmit} disabled={!item}>
            Save adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
