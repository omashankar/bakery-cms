import type { PlacedOrder } from "@/features/orders/lib/orders";

/**
 * Who is allowed to see an order.
 *
 * The order pages used to render from the URL alone, so anyone holding (or
 * guessing) an order number saw the customer's name, phone, email and full
 * delivery address. The track-order form asked for an email, but the detail
 * page it redirected to never checked anything — the gate was decorative.
 *
 * Access is granted when either:
 *  - the signed-in customer owns the order, or
 *  - this browser proved ownership through the track-order form.
 *
 * NOTE: this runs in the browser, so it is a UI gate, not enforcement. It stops
 * a shared link exposing someone's details, but the real check has to live on
 * the server once orders move there — the shape here is what that endpoint
 * should implement.
 */

const ACCESS_KEY = "bakery-cms-verified-orders";

function readGrants(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(ACCESS_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Called after the track-order form verifies an email against the order. */
export function grantOrderAccess(orderNumber: string): void {
  if (typeof window === "undefined") return;
  const grants = readGrants();
  if (grants.includes(orderNumber)) return;
  try {
    sessionStorage.setItem(ACCESS_KEY, JSON.stringify([...grants, orderNumber]));
  } catch {
    // Storage full or blocked — the session check below still applies.
  }
}

function hasVerifiedAccess(orderNumber: string): boolean {
  return readGrants().includes(orderNumber);
}

export function ownsOrder(order: PlacedOrder, viewerEmail?: string | null): boolean {
  const email = viewerEmail?.trim().toLowerCase();
  if (!email) return false;
  return order.address?.email?.trim().toLowerCase() === email;
}

export function canViewOrder(order: PlacedOrder, viewerEmail?: string | null): boolean {
  return ownsOrder(order, viewerEmail) || hasVerifiedAccess(order.orderNumber);
}
