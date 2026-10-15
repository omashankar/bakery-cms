"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import type { PlacedOrder } from "@/features/orders/lib/orders";

/**
 * "CANCEL THIS ORDER?" — shown only where the products' "Order cancel"
 * toggle allows it and the shop has not started preparing (the caller checks
 * with `customerCancellation`, and the server checks again).
 */
export function CancelOrderDialog({
  order,
  open,
  onOpenChange,
  onCancelled,
}: {
  order: PlacedOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancelled: (order: PlacedOrder) => void;
}) {
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const paidOnline = order.paymentStatus === "paid";

  async function submit() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/customer-auth/orders/${encodeURIComponent(order.orderNumber)}/cancellation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ reason: reason.trim() || undefined }),
        },
      );
      const body = (await res.json().catch(() => null)) as
        | { data?: PlacedOrder; message?: string }
        | null;
      if (!res.ok || !body?.data) {
        // The shop's own words for why not — e.g. preparation has started.
        setError(body?.message || "The order could not be cancelled. Please try again.");
        return;
      }
      setReason("");
      onCancelled(body.data);
    } catch {
      setError("The order could not be cancelled. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel order {order.orderNumber}?</DialogTitle>
          <DialogDescription>
            {paidOnline
              ? "Your order will be cancelled and what you paid online will be refunded to the way you paid."
              : "Your order will be cancelled."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Why are you cancelling? (optional)</Label>
          <textarea
            id="cancel-reason"
            rows={3}
            maxLength={300}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Keep my order
          </Button>
          <Button variant="bakery" onClick={() => void submit()} disabled={sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : null}
            Cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
