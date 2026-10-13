import type { PlacedOrder } from "@/features/orders/lib/orders";

/**
 * An order as its customer may see it.
 *
 * `adminNotes` is the box the admin labels "Internal notes", and the refund
 * notes are the staff's reasons for a decision. Both are written for the shop,
 * not for the person the order belongs to.
 *
 * One function for every customer-facing read. The lookup by order number
 * stripped these, and My Orders — the second door a customer has — returned the
 * whole document, so a note like "refuse further refunds" was one network tab
 * away from the customer it was about.
 */
export function withoutStaffOnlyFields<T extends PlacedOrder | null>(order: T): T {
  if (!order) return order;
  const { adminNotes: _adminNotes, refundRecord, ...rest } = order;

  return {
    ...rest,
    ...(refundRecord
      ? {
          refundRecord: {
            ...refundRecord,
            notes: undefined,
            history: refundRecord.history?.map((entry) => ({ ...entry, note: undefined })),
          },
        }
      : {}),
  } as T;
}
