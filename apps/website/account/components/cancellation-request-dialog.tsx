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
import {
  CANCELLATION_REASON_LABELS,
  CUSTOMER_CANCELLATION_REASONS,
  EXCEPTION_REASONS,
  evaluateCancellation,
  isExceptionReason,
  preparationStage,
  preparationStartedAt,
  type CancellationReason,
} from "@/features/orders/lib/cancellation-policy";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { cn } from "@/lib/utils";

/**
 * ASKING TO CANCEL — or, once the order has left the shop, reporting a problem.
 *
 * The customer sees what the policy will say BEFORE they send: the same
 * `evaluateCancellation` the server enforces, judged by the policy copied onto
 * their order. A request is only a request — nothing is cancelled or refunded
 * until the shop decides, and the dialog says so.
 */
export function CancellationRequestDialog({
  order,
  open,
  onOpenChange,
  onSubmitted,
}: {
  order: PlacedOrder;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: (order: PlacedOrder) => void;
}) {
  const stage = preparationStage(order.status);
  // After it has left the shop, a change of mind is no longer a cancellation —
  // only a problem with what arrived is.
  const problemsOnly = stage === "dispatched" || stage === "delivered";
  const reasons = problemsOnly
    ? CUSTOMER_CANCELLATION_REASONS.filter((reason) => isExceptionReason(reason))
    : CUSTOMER_CANCELLATION_REASONS;

  const [reason, setReason] = useState<CancellationReason | "">("");
  const [detail, setDetail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /*
    What the policy will say. Judged by the copy on the order when there is
    one; an older order without a copy is judged by its products on the
    server, so here only the parts that do not depend on them are predicted.
  */
  const policyClass = order.cancellationPolicy?.policyClass;
  const judgement = reason
    ? evaluateCancellation({
        policyClass: policyClass ?? "standard",
        stage,
        startedAt: preparationStartedAt(order),
        reason,
      })
    : null;
  const predictable =
    judgement !== null &&
    (policyClass !== undefined ||
      judgement.eligibility === "exception_review" ||
      judgement.eligibility === "not_allowed");
  const blocked = judgement?.eligibility === "not_allowed";

  function reset() {
    setReason("");
    setDetail("");
    setError(null);
  }

  async function submit() {
    if (!reason || blocked) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/customer-auth/orders/${encodeURIComponent(order.orderNumber)}/cancellation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ reason, detail: detail.trim() || undefined }),
        },
      );
      const body = (await res.json().catch(() => null)) as
        | { success?: boolean; data?: PlacedOrder; message?: string }
        | null;
      if (!res.ok || !body?.data) {
        // The shop's own words for why not — "already open", "already left".
        setError(body?.message || "Your request could not be sent. Please try again.");
        return;
      }
      reset();
      onSubmitted(body.data);
    } catch {
      setError("Your request could not be sent. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{problemsOnly ? "Report a problem" : "Request cancellation"}</DialogTitle>
          <DialogDescription>
            Order {order.orderNumber}. The shop reviews every request — nothing is cancelled or
            refunded until it replies.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">What happened?</Label>
            <select
              id="cancel-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value as CancellationReason)}
              className="h-10 w-full rounded-lg border border-input bg-card px-3 text-sm"
            >
              <option value="" disabled>
                Choose a reason
              </option>
              {reasons.map((option) => (
                <option key={option} value={option}>
                  {CANCELLATION_REASON_LABELS[option]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancel-detail">
              {reason && (EXCEPTION_REASONS as readonly string[]).includes(reason)
                ? "Tell us what went wrong"
                : "Anything else? (optional)"}
            </Label>
            <textarea
              id="cancel-detail"
              rows={3}
              maxLength={1000}
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
            />
          </div>

          {judgement ? (
            <p
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                blocked
                  ? "bg-destructive/10 text-destructive"
                  : judgement.eligibility === "non_refundable"
                    ? "bg-amber-50 text-amber-900"
                    : "bg-muted text-foreground",
              )}
            >
              {predictable ? judgement.explanation : "The shop will review your request and reply."}
            </p>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Keep my order
          </Button>
          <Button variant="bakery" onClick={() => void submit()} disabled={!reason || blocked || sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : null}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
