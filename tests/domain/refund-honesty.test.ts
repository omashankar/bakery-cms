import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Source with comments removed.
 *
 * `toContain` cannot tell code from a description of code, and these tests
 * describe the very strings they assert are gone — an assertion that a call had
 * been removed passed because the comment explaining its removal quoted it.
 */
function codeOf(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

const SERVICE = codeOf("features/orders/server/order.service.ts");
const REPOSITORY = codeOf("features/orders/server/order.repository.ts");

function bodyOf(source: string, signature: string, close = "\n}"): string {
  const start = source.indexOf(signature);
  expect(start, `not found: ${signature}`).toBeGreaterThan(-1);
  return source.slice(start, source.indexOf(close, start));
}

/**
 * A refusal has to say whether the money moved, because only the refund path
 * knows — and both screens were asserting it for themselves.
 *
 * The Refund Centre appended "No money has moved. Nothing was recorded." to
 * EVERY refusal, including the one where the gateway accepts a payout it will
 * not name. That is the case where the money is most likely already gone, and
 * the screen was the most confident it was not.
 */
describe("a refused refund says whether the money moved", () => {
  const branch = SERVICE.slice(
    SERVICE.indexOf("if (outcome.ok) {"),
    SERVICE.indexOf("outcome.refused", SERVICE.indexOf("if (outcome.ok) {")),
  );

  it("does not claim safety when the gateway accepted without an id", () => {
    expect(branch).toContain("did not identify it");
    expect(branch).toContain("may already be on its way");
    expect(branch).not.toContain("No money has moved");
  });

  it("says no money moved when the gateway refused, and when it was unreachable", () => {
    const fn = bodyOf(SERVICE, "export async function refund(");
    expect(fn).toMatch(/\$\{outcome\.refused\} No money has moved\./);
    expect(fn).toMatch(/No money has moved — try again/);
  });

  it("neither screen appends a claim of its own", () => {
    for (const file of [
      "apps/admin/commerce/pages/refund-center-admin-page.tsx",
      "apps/admin/commerce/pages/order-detail-page.tsx",
    ]) {
      expect(codeOf(file), `${file} must not assert this for itself`).not.toContain(
        "No money has moved. Nothing was recorded.",
      );
    }
  });

  it("the order detail screen surfaces the server's reason", () => {
    const page = codeOf("apps/admin/commerce/pages/order-detail-page.tsx");
    const fn = bodyOf(page, "async function handleRefund(", "\n  }");

    // It called `reportUnpersisted("Refund recorded")`, which toasts "Refund
    // recorded on this device only". Both halves were wrong: the write path
    // rolls back on refusal so nothing was recorded anywhere, and the server's
    // explanation was thrown away. An admin read "recorded" and closed the
    // ticket with no refund made.
    // The DESTRUCTURE, not just the use. `toContain("error")` passes against a
    // handler that stops reading it from the result and declares its own
    // `const error = undefined` — the toast still says the same words and always
    // falls through to the generic message.
    expect(fn).toMatch(
      /const \{ order: updated, persisted, error \} = await refundOrder\(order\.id, input\)/,
    );
    expect(fn).toContain('toast.error(error ?? "The refund was not accepted.")');
    expect(fn).not.toContain("reportUnpersisted");
    expect(fn).not.toContain('toast.success("Refund recorded"');
  });
});

/** A note must never be able to erase a settle. */
describe("saving a refund note", () => {
  it("writes one field, not the whole record", () => {
    const fn = bodyOf(REPOSITORY, "export async function setRefundNotes(");

    // The $SET branch specifically. Asserting `"refundRecord.notes"` anywhere in
    // the function passes against a $set that replaces the whole record, because
    // the $unset branch still names the dotted path.
    expect(fn).toMatch(/\$set: \{ "refundRecord\.notes": notes,/);

    // Setting `refundRecord` itself is the shape that erased `stockRestored` and
    // `couponReleased` when a webhook settle landed between a read and a write —
    // and the next settle then restored the stock and released the coupon again.
    expect(fn).not.toMatch(/\$set: \{[^}]*\brefundRecord:/);
    expect(fn).not.toContain("...order.refundRecord");
    expect(fn).not.toContain("...record");
  });

  it("clears the note rather than storing an empty one", () => {
    const fn = bodyOf(REPOSITORY, "export async function setRefundNotes(");
    expect(fn).toContain("$unset");
  });

  it("the service no longer patches the whole record", () => {
    const fn = bodyOf(SERVICE, "export async function updateRefundNotes(");

    expect(fn).toContain("repo.setRefundNotes(id,");
    expect(fn).not.toContain("...order.refundRecord");
    expect(fn).not.toContain("repo.patch(");

    // An order with no refund is refused rather than silently accepted — it used
    // to return the order unchanged, so the endpoint answered 200 with the note
    // discarded.
    //
    // BOTH guards, counted. There are two — the pre-read check and the "the
    // write matched nothing" check — and `toMatch` on one message passed while
    // the other had been turned back into `return order`.
    const refusals = fn.match(/throw new AppError\("This order has no refund/g) ?? [];
    expect(refusals).toHaveLength(2);
    expect(fn).not.toContain("return order;");
  });
});

/** "Refund requested" that requested nothing. */
describe("requesting a refund", () => {
  const fn = bodyOf(SERVICE, "export async function requestRefund(");

  it("refuses a non-cancelled order instead of answering 200", () => {
    // Both refusals used to be `return order`, so the controller answered 200
    // "Refund requested" having recorded nothing at all.
    expect(fn).toContain("only be requested for a cancelled order");
    expect(fn).not.toMatch(/order\.status !== "cancelled" \|\| order\.refundRecord\) return order/);
  });

  it("refuses a second request rather than discarding it", () => {
    expect(fn).toContain("already been requested");
  });

  it("throws rather than returning the order unchanged", () => {
    const returns = fn.match(/return order;/g) ?? [];
    expect(returns).toHaveLength(0);
  });
});
