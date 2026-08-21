import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { TEMPLATE_VARIABLE_CONTRACT } from "@/features/communications/lib/template-contract";
import { seedEmailTemplates } from "@/features/communications/lib/email-template-seed";
import { defaultTemplateSampleData } from "@/features/communications/lib/template-sample-data";

function codeOf(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * Cancelling wrote a status, put the stock back and released the coupon, and
 * sent nothing at all.
 *
 * The customer found out by the cake never arriving — and if they had paid,
 * their money was sitting in the gateway with nothing anywhere saying so. Every
 * other status change they care about had an email; the one they most needed
 * was the one that did not.
 */
describe("a cancelled customer is told", () => {
  it("the cancellation has a wired template", () => {
    expect(TEMPLATE_VARIABLE_CONTRACT).toHaveProperty("order_cancelled");
  });

  it("the template says what happens to their money", () => {
    // Whether anything is coming back depends on whether anything was taken,
    // and that is the first thing they will ask.
    expect(TEMPLATE_VARIABLE_CONTRACT.order_cancelled).toContain("refund_note");
  });

  it("a row is seeded for the admin to edit", () => {
    const row = seedEmailTemplates().find((item) => item.slug === "order_cancelled");
    expect(row).toBeDefined();
    expect(row?.body).toContain("{{refund_note}}");
    expect(row?.body).toContain("{{order_number}}");
  });

  it("has a fallback, so an unpublished template does not silence it again", () => {
    const service = codeOf("features/communications/server/email.service.ts");
    const fallbacks = service.slice(service.indexOf("const FALLBACKS"));
    expect(fallbacks).toContain("order_cancelled:");
    expect(fallbacks).toContain("{{refund_note}}");
  });

  it("every variable it declares has preview sample data", () => {
    // Without this the admin's preview renders `[refund_note]` and the real send
    // is the first time anyone sees the wording.
    for (const variable of TEMPLATE_VARIABLE_CONTRACT.order_cancelled) {
      expect(defaultTemplateSampleData[variable], variable).toBeDefined();
    }
  });

  it("cancelling sends it, and the note depends on whether money was taken", () => {
    const service = codeOf("features/orders/server/order.service.ts");
    const cancel = service.slice(
      service.indexOf("export async function cancel("),
      service.indexOf("\n}", service.indexOf("export async function cancel(")),
    );

    expect(cancel).toContain("notifyOrderCancelled(updated, holdsPayment)");
    expect(cancel).toMatch(/const holdsPayment = order\.paymentStatus === "paid"/);

    const sender = service.slice(
      service.indexOf("async function notifyOrderCancelled("),
      service.indexOf("\n}", service.indexOf("async function notifyOrderCancelled(")),
    );
    expect(sender).toContain("refund_note: holdsPayment");
    expect(sender).toContain("a refund is on its way");
    expect(sender).toContain("nothing to refund");
  });

  it("a failed send does not fail the cancellation", () => {
    // The order IS cancelled; reporting that as a failure would have an operator
    // do it twice, and cancelling twice used to restore the stock twice.
    const service = codeOf("features/orders/server/order.service.ts");
    const sender = service.slice(
      service.indexOf("async function notifyOrderCancelled("),
      service.indexOf("\n}", service.indexOf("async function notifyOrderCancelled(")),
    );
    expect(sender).toContain("if (!mail.sent)");
    expect(sender).toContain("console.error");
    expect(sender).not.toContain("throw");
  });
});
