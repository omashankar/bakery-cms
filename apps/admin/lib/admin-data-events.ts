import { INVENTORY_UPDATED_EVENT } from "@/apps/admin/commerce/lib/inventory-repository";
import { NOTIFICATIONS_UPDATED_EVENT } from "@/apps/admin/commerce/lib/notifications-repository";
import { INQUIRIES_UPDATED_EVENT } from "@/features/inquiries/lib/inquiries-repository";
import { PRODUCTS_UPDATED_EVENT } from "@/features/products/lib/products-repository";

export const ORDERS_UPDATED_EVENT = "bakery-orders-updated";

/**
 * The client-side stores the admin's derived screens read. Each is filled by a
 * server-sync hook in the admin layout, and each fires its event when that
 * hydration lands.
 *
 * These screens read their stores synchronously (they back `useMemo`-style
 * derivations that cannot await), so they render whatever the browser had cached
 * at mount and must re-read when the server's copy arrives. Subscribing to the
 * whole set — rather than the two or three events a given screen looks obviously
 * related to — is deliberate: the derivations cross stores (stock alerts come
 * from products, notification counts come from orders *and* inquiries *and*
 * products), so a partial subscription silently leaves a card or badge stale.
 */
export const ADMIN_DATA_EVENTS = [
  ORDERS_UPDATED_EVENT,
  INVENTORY_UPDATED_EVENT,
  INQUIRIES_UPDATED_EVENT,
  NOTIFICATIONS_UPDATED_EVENT,
  PRODUCTS_UPDATED_EVENT,
] as const;

/** Subscribe `handler` to every admin data store; returns the unsubscribe. */
export function subscribeToAdminData(handler: () => void): () => void {
  for (const event of ADMIN_DATA_EVENTS) {
    window.addEventListener(event, handler);
  }

  return () => {
    for (const event of ADMIN_DATA_EVENTS) {
      window.removeEventListener(event, handler);
    }
  };
}
