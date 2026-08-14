import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/** Source with comments removed — `toContain` cannot tell code from prose. */
function codeOf(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * The order detail screen is where an operator goes to find out what happened
 * to an order.
 *
 * It returned as soon as localStorage had one — and that cache holds only the
 * most recent page of orders written by whatever this browser last did. So an
 * order refunded on another device, settled by a webhook, or cancelled by a
 * colleague rendered in its old state for the whole visit.
 *
 * Worse after a write: the post-write refresh re-read that same cache, which is
 * where the optimistic copy lives — including one the server had REFUSED and the
 * write path had already rolled back.
 */
describe("the order detail screen asks the server", () => {
  const page = codeOf("apps/admin/commerce/pages/order-detail-page.tsx");
  const effect = page.slice(page.indexOf("useEffect(() => {"), page.indexOf("}, [orderId]);"));

  it("fetches on mount whether or not the cache had it", () => {
    // The give-away shape: an `else` that only fetches on a cache MISS.
    expect(effect).not.toMatch(/\}\s*else\s*\{[\s\S]*fetchOrder/);
    expect(effect).toContain("fetchOrder(orderId)");
  });

  it("still paints the cached copy immediately, so the page does not flash empty", () => {
    expect(effect).toContain("const current = getOrderById(orderId)");
    expect(effect).toMatch(/if \(current\) \{/);
  });

  it("re-reads the server after a write, not just the cache", () => {
    const refresh = effect.slice(effect.indexOf("function refresh()"));
    expect(refresh).toContain("getOrderById(orderId)");
    expect(refresh).toContain("fetchOrder(orderId)");
  });

  it("guards BOTH late responses against a navigation", () => {
    // There are two fetches — the mount read and the post-write refresh — and
    // asserting the string appears passes while either one is unguarded. A
    // response landing after the operator has moved to another order would
    // render that order's data under this one's id.
    expect(effect.match(/if \(cancelled/g) ?? []).toHaveLength(2);

    const refresh = effect.slice(effect.indexOf("function refresh()"));
    expect(refresh).toMatch(/if \(cancelled \|\| !fetched\) return;/);
  });
});

/**
 * A gateway refund is created `pending` and settles at the bank's pace. The
 * Refund Centre printed the amount ASKED FOR under the word "refunded", so the
 * moment an operator issued one the screen said the money was back with the
 * customer — on the screen they open to answer exactly that question.
 */
describe("the refund case detail distinguishes sent from settled", () => {
  const page = codeOf("apps/admin/commerce/pages/refund-center-admin-page.tsx");

  it("says 'refunded' only for what has actually been paid out", () => {
    expect(page).toContain("settledRefundAmount(order)");
    // The unconditional claim.
    expect(page).not.toMatch(/\{formatCurrency\(order\.refundRecord\.amount\)\} refunded/);
  });

  it("words an unsettled refund as sent, not received", () => {
    expect(page).toContain("sent to the gateway");
  });

  it("says how much is still in flight", () => {
    expect(page).toContain("has not reached the customer yet");
    expect(page).toMatch(
      /settledRefundAmount\(order\) < order\.refundRecord\.amount/,
    );
  });
});

/**
 * The Payments page falls back to figures computed over this browser's order
 * cache. `serverBacked` existed to disclose that and was used on exactly one of
 * the eight cards.
 */
describe("the payments page discloses its fallback everywhere", () => {
  const page = codeOf("apps/admin/commerce/pages/payments-admin-page.tsx");

  it("routes every card's subtitle through the disclosure helper", () => {
    const cards = (page.match(/<DashboardStatCard/g) ?? []).length;
    const noted = (page.match(/change=\{note\(/g) ?? []).length;

    expect(cards).toBe(8);
    expect(noted).toBe(8);
  });

  it("gives every card the warning tone when the server did not answer", () => {
    expect((page.match(/changeTone=\{noteTone\(/g) ?? []).length).toBe(8);
  });

  it("says it once above the charts too", () => {
    // A chart discloses even less about its provenance than a number does.
    expect(page).toContain("Totals and charts below are lower than");
    expect(page).toMatch(/mounted && !serverBacked/);
  });
});
