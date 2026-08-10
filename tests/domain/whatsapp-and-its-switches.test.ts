import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { keepServerApproval } from "@/features/communications/server/communications.service";
import {
  countSurplusParameters,
  countUnfilledSlots,
} from "@/apps/admin/communications/lib/whatsapp-template-utils";
import { PAYMENT_NOTIFICATION_TEMPLATES } from "@/features/payments/registry/notification-templates";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * Meta approves a `message_templates` row per NAME AND LANGUAGE.
 * `listMetaTemplates` keys its results `name|language` and `planMetaSync` builds
 * its lookup the same way — for exactly that reason.
 *
 * `keepServerApproval` compared the name alone. So an admin who kept the name
 * and switched the language from `en` to `hi` carried the old approval across:
 * the send path gates only on that flag (`if (template.approval !== "approved")
 * return`) and then passes the NEW language straight to Meta, which has approved
 * nothing under it. Every send is rejected, and the screen still shows the
 * template as approved.
 */
describe("what happens to Meta's approval when the binding changes", () => {
  const stored = [
    { id: "t1", metaName: "order_confirmation_v1", metaLanguage: "en", approval: "approved" },
  ];

  it("keeps it when neither half moved", () => {
    const [result] = keepServerApproval(
      [{ id: "t1", metaName: "order_confirmation_v1", metaLanguage: "en" }],
      stored,
    ) as { approval: string }[];

    expect(result.approval).toBe("approved");
  });

  it("drops it when the NAME changes", () => {
    const [result] = keepServerApproval(
      [{ id: "t1", metaName: "order_confirmation_v2", metaLanguage: "en" }],
      stored,
    ) as { approval: string }[];

    expect(result.approval).toBe("not_submitted");
  });

  it("drops it when the LANGUAGE changes", () => {
    const [result] = keepServerApproval(
      [{ id: "t1", metaName: "order_confirmation_v1", metaLanguage: "hi" }],
      stored,
    ) as { approval: string }[];

    expect(result.approval).toBe("not_submitted");
  });

  it("treats whitespace and a missing language the same way for both halves", () => {
    const [padded] = keepServerApproval(
      [{ id: "t1", metaName: " order_confirmation_v1 ", metaLanguage: " en " }],
      stored,
    ) as { approval: string }[];
    expect(padded.approval).toBe("approved");

    const [dropped] = keepServerApproval(
      [{ id: "t1", metaName: "order_confirmation_v1" }],
      stored,
    ) as { approval: string }[];
    expect(dropped.approval).toBe("not_submitted");
  });

  it("never invents an approval for a row the server has not seen", () => {
    const [result] = keepServerApproval(
      [{ id: "new", metaName: "order_confirmation_v1", metaLanguage: "en" }],
      stored,
    ) as { approval: string }[];

    expect(result.approval).toBe("not_submitted");
  });
});

/**
 * Meta rejects a send whose parameter count does not match the approved body,
 * in EITHER direction. `countUnfilledSlots` walks `Array.from({ length: slots })`
 * so it can only ever see too few — with two slots and three parameters it
 * counts zero blanks and the amber alert never renders. With `parameterCount: 0`
 * the panel positively states "This template takes no variables" while the
 * surplus rows sit in the record.
 */
describe("a parameter mapping that does not match the approved body", () => {
  it("counts the values Meta has no slot for", () => {
    expect(countSurplusParameters(2, ["a", "b", "c"])).toBe(1);
    expect(countSurplusParameters(0, ["a", "b", "c"])).toBe(3);
  });

  it("counts none when the mapping fits", () => {
    expect(countSurplusParameters(3, ["a", "b", "c"])).toBe(0);
    expect(countSurplusParameters(3, ["a"])).toBe(0);
    expect(countSurplusParameters(0, [])).toBe(0);
    expect(countSurplusParameters(2, undefined)).toBe(0);
  });

  it("ignores blanks, which are the other alert's business", () => {
    expect(countSurplusParameters(1, ["a", "", "  "])).toBe(0);
    expect(countUnfilledSlots(3, ["a", "", "  "])).toBe(2);
  });

  it("is said on the screen, where the count is known", () => {
    const panel = source(
      "apps/admin/communications/components/whatsapp-meta-binding-fields.tsx",
    );

    expect(panel).toContain("countSurplusParameters(slots, parameters)");
    expect(panel).toContain("{surplus > 0 ? (");
    expect(panel).toMatch(/more value\{surplus === 1/);
  });
});

/**
 * The email in `placeOrder` is gated on the Payment Notifications switch, with a
 * comment saying "Its switches stored a preference that nothing read". Its
 * WhatsApp sibling thirty lines below sent unconditionally — and the registry
 * did not list `whatsapp` among that event's channels, so the screen showed the
 * chip OFF while WhatsApp kept going out. Every `isNotificationEnabled` call in
 * the codebase passed "email"; nothing anywhere passed "whatsapp".
 */
describe("the Payment Success switch", () => {
  it("gates the WhatsApp confirmation, not only the email", () => {
    const service = source("features/orders/server/order.service.ts");

    expect(service).toContain(
      'if (await isNotificationEnabled("cust_payment_success", "whatsapp"))',
    );
    expect(service).toContain('isNotificationEnabled("cust_payment_success", "email")');
  });

  it("lists the channel the sender actually uses, so the default is not a silent switch-off", () => {
    const template = PAYMENT_NOTIFICATION_TEMPLATES.find(
      (item) => item.id === "cust_payment_success",
    );

    // The chip state is `saved?.channels ?? template?.channels`, so a shop that
    // has never touched the screen takes this list. Without "whatsapp" here,
    // adding the gate would stop a message every such shop receives today.
    expect(template?.channels).toContain("whatsapp");
    expect(template?.channels).toContain("email");
  });

  it("leaves the sends that have no switch behind them alone", () => {
    const service = source("features/orders/server/order.service.ts");

    // `order_ready` and `delivery_update` have no entry in the payment
    // notification registry — the screen makes no claim about them, so gating
    // them would invent a rule rather than honour one.
    const sends = service.match(/await notifyWhatsApp\(/g) ?? [];
    const whatsappGates = service.match(/isNotificationEnabled\("[^"]+", "whatsapp"\)/g) ?? [];

    expect(sends).toHaveLength(3);
    expect(whatsappGates).toHaveLength(1);
    expect(service).toContain('"order_ready"');
    expect(service).toContain('"delivery_update"');
  });
});
