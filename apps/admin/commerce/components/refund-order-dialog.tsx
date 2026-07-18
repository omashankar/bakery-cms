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
import { AdminSelect, adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { REFUND_REASON_OPTIONS } from "@/apps/admin/commerce/lib/refund-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RefundOrderInput } from "@/features/orders/lib/orders";
import type { RefundReasonCode } from "@/types/refund";

interface RefundOrderDialogProps {
  open: boolean;
  orderNumber?: string;
  totalLabel?: string;
  /** Numeric order total — enables partial-refund validation. */
  orderTotal?: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: RefundOrderInput) => void;
}

export function RefundOrderDialog({
  open,
  orderNumber,
  totalLabel,
  orderTotal,
  onOpenChange,
  onConfirm,
}: RefundOrderDialogProps) {
  const [reason, setReason] = useState<RefundReasonCode>("customer_request");
  const [reasonDetail, setReasonDetail] = useState("");
  const [notes, setNotes] = useState("");
  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");

  function resetForm() {
    setReason("customer_request");
    setReasonDetail("");
    setNotes("");
    setRefundType("full");
    setAmount("");
  }

  const partialValue = Number(amount);
  const partialInvalid =
    refundType === "partial" &&
    (!amount ||
      !Number.isFinite(partialValue) ||
      partialValue <= 0 ||
      (orderTotal !== undefined && partialValue > orderTotal));

  function handleConfirm() {
    if (partialInvalid) return;
    onConfirm({
      reason,
      reasonDetail: reasonDetail.trim() || undefined,
      notes: notes.trim() || undefined,
      amount: refundType === "partial" ? partialValue : orderTotal,
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
          {/* Full vs partial */}
          <div className="space-y-2">
            <Label>Refund type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["full", "partial"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setRefundType(type)}
                  className={
                    "rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors " +
                    (refundType === type
                      ? "border-bakery-700 bg-cream-50 text-bakery-700"
                      : "border-border bg-card text-muted-foreground hover:bg-muted")
                  }
                >
                  {type} refund
                </button>
              ))}
            </div>
          </div>

          {refundType === "partial" ? (
            <div className="space-y-2">
              <Label htmlFor="refund-amount">
                Refund amount{orderTotal !== undefined ? ` (max ₹${orderTotal})` : ""}
              </Label>
              <Input
                id="refund-amount"
                type="number"
                inputMode="numeric"
                min={1}
                max={orderTotal}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="Enter amount to refund"
              />
              {partialInvalid ? (
                <p className="text-xs text-destructive">
                  Enter an amount between ₹1 and ₹{orderTotal ?? "total"}.
                </p>
              ) : null}
            </div>
          ) : null}

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
          <Button variant="bakery" onClick={handleConfirm} disabled={partialInvalid}>
            {refundType === "partial" && amount
              ? `Refund ₹${partialValue || 0}`
              : "Confirm refund"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
