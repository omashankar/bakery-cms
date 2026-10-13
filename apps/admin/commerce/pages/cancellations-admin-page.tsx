"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components/admin-page";
import { AdminSelect, adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { reportedAsSignedOut } from "@/apps/admin/lib/report-write";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/shared/empty-state";
import { routes } from "@/constants/routes";
import { cartLineChoices } from "@/features/cart/lib/cart";
import {
  CANCELLATION_CLASS_CUSTOMER_TEXT,
  CANCELLATION_REASON_LABELS,
  CANCELLATION_REQUEST_STATUS_LABELS,
  CANCELLATION_RESOLUTIONS,
  CANCELLATION_RESOLUTION_LABELS,
  PREPARATION_STAGE_LABELS,
  REFUND_STATE_LABELS,
  isExceptionReason,
  isOpenCancellationRequest,
  preparationStage,
  preparationStartedAt,
  refundState,
  type CancellationResolution,
} from "@/features/orders/lib/cancellation-policy";
import { settledRefundAmount } from "@/features/orders/lib/order-overviews";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/utils/format";
import { CircleSlash } from "lucide-react";

type Tab = "open" | "decided" | "all";

const ELIGIBILITY_TEXT = {
  eligible: "Policy: refundable in full",
  non_refundable: "Policy: not refundable for a change of mind",
  exception_review: "Problem reported — review the facts",
  not_allowed: "Policy: not allowed",
} as const;

/**
 * CANCELLATIONS — every request, what the policy says about it, and the shop's
 * decision.
 *
 * The page is a convenience; the rules are on the server. Every action posts
 * to `/api/orders/[id]/cancellation`, which checks the role, the policy, that
 * the request is still open, and the amount — and answers 409 when another
 * admin got there first.
 */
export function CancellationsAdminPage({ initial }: { initial: PlacedOrder[] | null }) {
  const [cases, setCases] = useState<PlacedOrder[]>(initial ?? []);
  const [tab, setTab] = useState<Tab>("open");
  const [problemsOnly, setProblemsOnly] = useState(false);
  const [deciding, setDeciding] = useState<PlacedOrder | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      cases.filter((order) => {
        const request = order.cancellationRequest;
        if (!request) return false;
        if (tab === "open" && !isOpenCancellationRequest(request.status)) return false;
        if (tab === "decided" && isOpenCancellationRequest(request.status)) return false;
        if (problemsOnly && !isExceptionReason(request.reason)) return false;
        return true;
      }),
    [cases, tab, problemsOnly],
  );
  const openCount = cases.filter((order) => isOpenCancellationRequest(order.cancellationRequest?.status)).length;

  async function reload() {
    try {
      const res = await fetch("/api/orders/cancellations", { credentials: "same-origin" });
      noteAuthStatus(res.status);
      const body = (await res.json()) as { data?: PlacedOrder[] };
      if (res.ok && body.data) setCases(body.data);
    } catch {
      // The list on screen stays; the next action reloads again.
    }
  }

  async function act(order: PlacedOrder, payload: Record<string, unknown>): Promise<boolean> {
    setBusy(order.id);
    try {
      const res = await fetch(`/api/orders/${order.id}/cancellation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      noteAuthStatus(res.status);
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        // An ended session says so itself; only a real refusal is reported here.
        if (!reportedAsSignedOut()) toast.error("Not saved", { description: body?.message ?? "Please reload and try again." });
        return false;
      }
      // The server's own words — including "the refund could not be started".
      if (body?.message?.includes("could not be started")) {
        toast.warning(body.message, { description: "Retry from the Refund Center." });
      } else {
        toast.success(body?.message ?? "Saved");
      }
      return true;
    } catch {
      if (!reportedAsSignedOut()) toast.error("Not saved", { description: "The server could not be reached." });
      return false;
    } finally {
      setBusy(null);
      void reload();
    }
  }

  return (
    <AdminPage>
      <AdminPageHeader
        title="Cancellations"
        description="Requests from customers to cancel an order or report a problem. Nothing is cancelled or refunded until you decide."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          {(
            [
              ["open", `Waiting (${openCount})`],
              ["decided", "Decided"],
              ["all", "All"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "rounded-md px-3 py-1.5 font-medium",
                tab === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={problemsOnly} onCheckedChange={setProblemsOnly} />
          Problems only
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={CircleSlash}
          title={tab === "open" ? "Nothing waiting" : "No requests here"}
          description="Cancellation requests and reported problems appear here."
        />
      ) : (
        <div className="space-y-4">
          {visible.map((order) => (
            <CaseCard
              key={order.id}
              order={order}
              busy={busy === order.id}
              onReview={() => void act(order, { action: "review" })}
              onDecide={() => setDeciding(order)}
            />
          ))}
        </div>
      )}

      {deciding ? (
        <DecideDialog
          order={deciding}
          onClose={() => setDeciding(null)}
          onConfirm={async (payload) => {
            const done = await act(deciding, { action: "decide", ...payload });
            if (done) setDeciding(null);
          }}
        />
      ) : null}
    </AdminPage>
  );
}

function CaseCard({
  order,
  busy,
  onReview,
  onDecide,
}: {
  order: PlacedOrder;
  busy: boolean;
  onReview: () => void;
  onDecide: () => void;
}) {
  const request = order.cancellationRequest!;
  const stage = preparationStage(order.status);
  const started = preparationStartedAt(order);
  const open = isOpenCancellationRequest(request.status);
  const refund = refundState(order);

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href={routes.admin.orders.detail(order.id)}
              className="font-heading text-base font-bold hover:underline"
            >
              {order.orderNumber}
            </Link>
            <p className="text-sm text-muted-foreground">
              {order.address.fullName} · {order.address.phone} · {order.address.email}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isExceptionReason(request.reason) ? <Badge variant="destructive">Problem</Badge> : null}
            <Badge variant={open ? "accent" : "outline"}>
              {CANCELLATION_REQUEST_STATUS_LABELS[request.status]}
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 text-sm md:grid-cols-2">
          <div className="space-y-1">
            <p className="font-medium">{CANCELLATION_REASON_LABELS[request.reason]}</p>
            {request.detail ? (
              <p className="whitespace-pre-line text-muted-foreground">&ldquo;{request.detail}&rdquo;</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Asked {formatDate(request.requestedAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
              {" · "}by {request.requestedBy === "customer" ? "the customer" : "the shop"}
            </p>
            <p className="text-xs font-medium text-foreground">{ELIGIBILITY_TEXT[request.eligibility]}</p>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <dt className="text-muted-foreground">Preparation</dt>
            <dd>
              {stage ? PREPARATION_STAGE_LABELS[stage] : "Closed"}
              {started
                ? ` · started ${formatDate(started, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}`
                : ""}
            </dd>
            <dt className="text-muted-foreground">Payment</dt>
            <dd>
              {formatCurrency(order.totals.total)} ·{" "}
              {order.paymentMethod === "cod" ? "Cash on delivery" : "Online"} ({order.paymentStatus})
            </dd>
            <dt className="text-muted-foreground">Policy</dt>
            <dd>
              {order.cancellationPolicy
                ? CANCELLATION_CLASS_CUSTOMER_TEXT[order.cancellationPolicy.policyClass]
                : "No copy (placed before policies were saved)"}
              {order.cancellationPolicy?.acceptedAt
                ? ` · agreed ${formatDate(order.cancellationPolicy.acceptedAt)}`
                : ""}
            </dd>
            <dt className="text-muted-foreground">Refund</dt>
            <dd>
              {REFUND_STATE_LABELS[refund]}
              {settledRefundAmount(order) > 0 ? ` · ${formatCurrency(settledRefundAmount(order))} paid back` : ""}
              {order.refundRecord?.reference ? ` · ${order.refundRecord.reference}` : ""}
              {order.refundRecord?.gatewayRefunds?.some((entry) => entry.testMode) ? " · TEST MODE" : ""}
            </dd>
          </dl>
        </div>

        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {order.items.map((item) => {
            const choices = cartLineChoices(item);
            return (
              <li key={item.id}>
                {item.quantity} × {item.name}
                {choices.length ? ` (${choices.join(" · ")})` : ""}
              </li>
            );
          })}
        </ul>

        {request.decision ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="font-medium">
              {CANCELLATION_RESOLUTION_LABELS[request.decision.resolution]}
              {request.decision.refundAmount ? ` · ${formatCurrency(request.decision.refundAmount)}` : ""}
            </span>{" "}
            — {request.decision.reason}
            <span className="block text-xs text-muted-foreground">
              {request.decision.actorEmail ?? "Staff"} · {formatDate(request.decision.at)}
            </span>
          </p>
        ) : null}

        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">History</summary>
          <ol className="mt-2 space-y-1">
            {request.history.map((event, index) => (
              <li key={`${event.at}-${index}`}>
                {formatDate(event.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })} ·{" "}
                {CANCELLATION_REQUEST_STATUS_LABELS[event.status]}
                {event.note ? ` — ${event.note}` : ""}
                {event.actor ? ` (${event.actor})` : ""}
              </li>
            ))}
          </ol>
        </details>

        {open ? (
          <div className="flex flex-wrap gap-2">
            {request.status === "requested" ? (
              <Button variant="outline" size="sm" disabled={busy} onClick={onReview}>
                Start review
              </Button>
            ) : null}
            <Button variant="bakery" size="sm" disabled={busy} onClick={onDecide}>
              Decide
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DecideDialog({
  order,
  onClose,
  onConfirm,
}: {
  order: PlacedOrder;
  onClose: () => void;
  onConfirm: (payload: { resolution: CancellationResolution; reason: string; refundAmount?: number }) => Promise<void>;
}) {
  const request = order.cancellationRequest!;
  // The policy's suggestion as the starting point, never as the answer.
  const suggested: CancellationResolution =
    request.eligibility === "eligible" ? "full_refund" : request.eligibility === "non_refundable" ? "cancel_no_refund" : "full_refund";
  const [resolution, setResolution] = useState<CancellationResolution>(suggested);
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const delivered = order.status === "delivered";
  const options = CANCELLATION_RESOLUTIONS.filter((option) => !(delivered && option === "cancel_no_refund"));
  const partialInvalid = resolution === "partial_refund" && !(Number(amount) > 0);

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Decide {order.orderNumber}</DialogTitle>
          <DialogDescription>
            {CANCELLATION_REASON_LABELS[request.reason]} · {ELIGIBILITY_TEXT[request.eligibility]}. The
            customer is emailed your decision and reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resolution">Decision</Label>
            <AdminSelect
              id="resolution"
              value={resolution}
              onChange={(event) => setResolution(event.target.value as CancellationResolution)}
            >
              {options.map((option) => (
                <option key={option} value={option}>
                  {CANCELLATION_RESOLUTION_LABELS[option]}
                </option>
              ))}
            </AdminSelect>
          </div>
          {resolution === "partial_refund" ? (
            <div className="space-y-2">
              <Label htmlFor="refund-amount">Amount to refund</Label>
              <Input
                id="refund-amount"
                type="number"
                inputMode="decimal"
                min={1}
                max={order.totals.total}
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="decision-reason">Reason (sent to the customer)</Label>
            <textarea
              id="decision-reason"
              className={adminTextareaClassName}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="bakery"
            disabled={saving || !reason.trim() || partialInvalid}
            onClick={async () => {
              setSaving(true);
              await onConfirm({
                resolution,
                reason: reason.trim(),
                ...(resolution === "partial_refund" ? { refundAmount: Number(amount) } : {}),
              });
              setSaving(false);
            }}
          >
            Save decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
