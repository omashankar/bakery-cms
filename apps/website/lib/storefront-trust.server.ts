import { cache } from "react";

import { getSettings } from "@/features/settings/server/settings.service";
import { approvedSiteAggregate } from "@/features/reviews/server/review.repository";
import { deliveryPromiseFor } from "@/apps/website/lib/product-details";
import { sameDayCutoffFor } from "@/features/orders/lib/delivery-date";
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
  /**
   * When same-day orders close, `HH:MM` — and ONLY when there is a same-day
   * window to close. "" for a shop that named no cutoff, stored something that
   * is not a time, or has a lead time above 0 days.
   *
   * The two settings are collapsed into one string here rather than sent
   * separately, because the browser has exactly one use for them: whether to
   * draw a deadline. Sending `deliveryLeadDays` as well would put the rule in
   * two places. `deliveryPromise` beside it is the cautionary tale in the
   * other direction — it is a SENTENCE, so nothing downstream can ask it a
   * question, and "Next-day delivery" had to be parsed to recover the number.
   */
  sameDayCutoff: string;
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

    /*
      ONE READING OF THE LEAD TIME, feeding the sentence and the clock. Two
      copies of this expression is how they drift — and the drift is not a
      wrong label, it is a countdown to a delivery the shop cannot make. An
      unreadable figure reads as NEXT-day here, which is this function's
      existing choice: a shop with nothing stored gets "Next-day delivery" and
      no countdown, rather than a promise and a deadline that contradict.
    */
    const lead = Number.isFinite(leadDays) ? leadDays : 1;

    return {
      freeDeliveryThreshold: Number.isFinite(threshold) && threshold > 0 ? threshold : 0,
      // The shipped default is used only when the field is genuinely absent —
      // never as a stand-in for a failed read, which returns null above.
      deliveryPromise: deliveryPromiseFor(lead),
      sameDayCutoff: sameDayCutoffFor(commerce?.sameDayCutoff, lead),
      rating: aggregate && aggregate.count > 0 ? aggregate : null,
    };
  } catch {
    // A settings read failing is not a reason to fail the homepage.
    return null;
  }
});
