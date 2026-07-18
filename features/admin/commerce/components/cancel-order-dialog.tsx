"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { adminTextareaClassName } from "@/features/admin/products/components/admin-field";

interface CancelOrderDialogProps {
  open: boolean;
  orderNumber?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
}

export function CancelOrderDialog({
  open,
  orderNumber,
  onOpenChange,
  onConfirm,
}: CancelOrderDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel order?</DialogTitle>
          <DialogDescription>
            {orderNumber
              ? `Order ${orderNumber} will be marked as cancelled. This is a demo action only.`
              : "This order will be marked as cancelled."}
          </DialogDescription>
        </DialogHeader>
        <form
          id="cancel-order-form"
          className="space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const reason = new FormData(form).get("reason")?.toString() ?? "";
            onConfirm(reason);
          }}
        >
          <Label htmlFor="cancel-reason">Cancellation reason (optional)</Label>
          <textarea
            id="cancel-reason"
            name="reason"
            className={adminTextareaClassName}
            placeholder="Customer requested cancellation..."
            rows={3}
          />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Keep order
          </Button>
          <Button variant="destructive" type="submit" form="cancel-order-form">
            Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
