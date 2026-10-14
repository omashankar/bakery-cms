import { formatCurrency } from "@/utils/format";

/** One fact in the band across the top of the storefront footer. */
export interface FooterPromise {
  icon: "truck" | "gift" | "shield";
  title: string;
  subtitle: string;
}

/**
 * The footer band's facts, from the shop's commerce settings and nothing else:
 * its delivery promise, its free-delivery threshold, and whether it takes
 * payment online. No customer counts, no city totals — numbers the software
 * cannot know. An empty list draws no band.
 */
export function footerPromisesFrom(
  commerce: Record<string, unknown>,
  currency: string | undefined,
): FooterPromise[] {
  const promises: FooterPromise[] = [];

  // A real number only: `Number(null)` is 0, which would promise same-day
  // delivery for a shop whose settings never said so.
  const lead = typeof commerce.deliveryLeadDays === "number" ? commerce.deliveryLeadDays : NaN;
  const cutoff = typeof commerce.sameDayCutoff === "string" ? commerce.sameDayCutoff.trim() : "";
  if (Number.isFinite(lead)) {
    promises.push(
      lead <= 0
        ? { icon: "truck", title: "Same-day delivery", subtitle: cutoff ? `Order by ${cutoff}` : "Order today, get it today" }
        : lead === 1
          ? { icon: "truck", title: "Next-day delivery", subtitle: "Order today, get it tomorrow" }
          : { icon: "truck", title: `Delivery in ${lead} days`, subtitle: `Order ${lead} days ahead` },
    );
  }

  const threshold = typeof commerce.freeDeliveryThreshold === "number" ? commerce.freeDeliveryThreshold : NaN;
  if (Number.isFinite(threshold) && threshold > 0) {
    promises.push({
      icon: "gift",
      title: "Free delivery",
      subtitle: `On orders over ${formatCurrency(threshold, currency)}`,
    });
  }

  const methods = (commerce.paymentMethods ?? {}) as Record<string, unknown>;
  if (methods.razorpay !== false && (methods.razorpay || methods.upi || methods.card)) {
    promises.push({ icon: "shield", title: "Secure payments", subtitle: "UPI, cards and netbanking" });
  }

  return promises;
}
