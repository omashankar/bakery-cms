"use client";

import { noteAuthStatus } from "@/features/auth/lib/session-expiry";

import type { OrderStatus } from "./orders";
import type { DeliveryOrderView, KitchenOrderView } from "./staff-order-types";

/**
 * The kitchen's and a rider's reads and their one write. Separate from
 * orders-api.ts on purpose: these never touch the full-order cache — the
 * people using them are not allowed the full orders, and the server sends
 * them only their own view.
 */

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T | null;
}

async function getList<T>(path: string): Promise<T[] | null> {
  try {
    const res = await fetch(path, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) {
      noteAuthStatus(res.status);
      return null;
    }
    const json = (await res.json()) as Envelope<T[]>;
    return json.success && Array.isArray(json.data) ? json.data : null;
  } catch {
    return null;
  }
}

export const fetchKitchenQueue = () => getList<KitchenOrderView>("/api/orders/kitchen");
export const fetchMyDeliveries = () => getList<DeliveryOrderView>("/api/orders/deliveries");

export interface StaffMoveResult<T> {
  ok: boolean;
  order?: T;
  /** The server's own words when it refused. */
  message?: string;
}

/** Move one order a step. Answers with the server's view of the order, or why not. */
export async function moveStaffOrder<T extends KitchenOrderView>(
  orderId: string,
  status: OrderStatus,
): Promise<StaffMoveResult<T>> {
  try {
    const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!res.ok) {
      noteAuthStatus(res.status);
      return { ok: false, message: json?.message || "That didn't save. Try again." };
    }
    return { ok: true, order: json?.data ?? undefined };
  } catch {
    return { ok: false, message: "No connection. Check your internet and try again." };
  }
}
