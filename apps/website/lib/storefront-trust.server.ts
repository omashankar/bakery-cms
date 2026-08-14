import { cache } from "react";

import { getSettings } from "@/features/settings/server/settings.service";
import { approvedSiteAggregate } from "@/features/reviews/server/review.repository";
import { deliveryPromiseFor } from "@/apps/website/lib/product-details";
import type { CommerceSettings } from "@/types/settings";

/**
 * The figures the homepage is entitled to state, read from the shop itself.
 *
 * The hero and the trust bar asserted all three as constants: "4.9 Rating ·
 * 2000+ reviews", "Same-Day Delivery · Order today, get today", and "Free
 * Delivery · On orders over ₹999". Every one of them is a number this CMS
 * already stores, so each was a second, stale copy of an answer the shop had
 * already given — and on this shop two of the three were simply wrong: the real
 * rating is 4.7 across 27 approved reviews, and `deliveryLeadDays` is 1, so it
 * cannot deliver same-day at all.
 *
 * Null means "we could not read the shop", and every caller renders nothing
 * rather than falling back to the demo values — which is what the old constants
 * were. `getStorefrontLocation` beside this file takes the same shape and makes
 * the same choice.
 */
export interface StorefrontTrust {
  /** 0 means the shop delivers free on every order, which checkout honours. */
  freeDeliveryThreshold: number;
  /** "Next-day delivery" and its siblings — the EARLIEST, never a guarantee. */
  deliveryPromise: string;
  /** Absent when nothing is approved: a shop with no reviews shows no score. */
  rating: { count: number; average: number } | null;
}

export const getStorefrontTrust = cache(async function getStorefrontTrust(
  settings?: { commerce?: CommerceSettings },
): Promise<StorefrontTrust | null> {
  try {
    const resolved = settings ?? ((await getSettings()) as { commerce?: CommerceSettings });
    const commerce = resolved.commerce;

    const threshold = Number(commerce?.freeDeliveryThreshold);
    const leadDays = Number(commerce?.deliveryLeadDays);

    const aggregate = await approvedSiteAggregate().catch(() => null);

    return {
      freeDeliveryThreshold: Number.isFinite(threshold) && threshold > 0 ? threshold : 0,
      // The shipped default is used only when the field is genuinely absent —
      // never as a stand-in for a failed read, which returns null above.
      deliveryPromise: deliveryPromiseFor(Number.isFinite(leadDays) ? leadDays : 1),
      rating: aggregate && aggregate.count > 0 ? aggregate : null,
    };
  } catch {
    // A settings read failing is not a reason to fail the homepage.
    return null;
  }
});
