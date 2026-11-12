"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@/features/orders/lib/orders";
import { moveStaffOrder } from "@/features/orders/lib/staff-orders-api";
import type { KitchenOrderView } from "@/features/orders/lib/staff-order-types";

const MOVE_LABELS: Partial<Record<OrderStatus, string>> = {
  preparing: "Start preparing",
  ready: "Mark ready",
  out_for_delivery: "Picked up — on the way",
  delivered: "Mark delivered",
};

/**
 * One step forward for one order. The server decides whether this member may
 * make the move; the button only offers the moves `staff-scope` says they can.
 */
export function StaffMoveButton<T extends KitchenOrderView>({
  order,
  to,
  onMoved,
  primary = false,
}: {
  order: T;
  to: OrderStatus;
  onMoved: (order: T) => void;
  primary?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const label = MOVE_LABELS[to] ?? to;

  async function move() {
    setBusy(true);
    const result = await moveStaffOrder<T>(order.id, to);
    setBusy(false);
    if (result.ok && result.order) {
      onMoved(result.order);
      toast.success(`${order.orderNumber}: ${label.toLowerCase()}`);
    } else {
      toast.error(result.message ?? "That didn't save. Try again.");
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant={primary ? "default" : "outline"}
      disabled={busy}
      onClick={() => void move()}
      className="min-h-10 flex-1"
    >
      {busy ? "Saving…" : label}
    </Button>
  );
}
