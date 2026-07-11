"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminSelect, adminTextareaClassName } from "@/features/admin/cakes/components/admin-field";
import { REFUND_REASON_OPTIONS } from "@/features/admin/commerce/lib/refund-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RefundOrderInput } from "@/features/storefront/checkout/lib/orders";
import type { RefundReasonCode } from "@/types/refund";

interface RefundOrderDialogProps {
  open: boolean;
  orderNumber?: string;
  totalLabel?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: RefundOrderInput) => void;
}

export function RefundOrderDialog({
  open,
  orderNumber,
  totalLabel,
  onOpenChange,
  onConfirm,
}: RefundOrderDialogProps) {
  const [reason, setReason] = useState<RefundReasonCode>("customer_request");
  const [reasonDetail, setReasonDetail] = useState("");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setReason("customer_request");
    setReasonDetail("");
    setNotes("");
  }

  function handleConfirm() {
    onConfirm({
      reason,
      reasonDetail: reasonDetail.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    resetForm();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue refund?</DialogTitle>
          <DialogDescription>
            {orderNumber
              ? `Record a demo refund for ${orderNumber}${totalLabel ? ` (${totalLabel})` : ""}.`
              : "Record a demo refund for this order."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refund-reason">Refund reason</Label>
            <AdminSelect
              id="refund-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as RefundReasonCode)}
            >
              {REFUND_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </AdminSelect>
          </div>

          {reason === "other" ? (
            <div className="space-y-2">
              <Label htmlFor="refund-reason-detail">Reason detail</Label>
              <Input
                id="refund-reason-detail"
                value={reasonDetail}
                onChange={(event) => setReasonDetail(event.target.value)}
                placeholder="Describe the refund reason"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="refund-notes">Internal notes</Label>
            <textarea
              id="refund-notes"
              className={adminTextareaClassName}
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional notes for the refund timeline"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="bakery" onClick={handleConfirm}>
            Confirm refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
