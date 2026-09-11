import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { quoteSchema } from "@/features/checkout/server/checkout.validators";
import { placeOrderSchema } from "@/features/orders/server/order.validators";
import type { OrderPersonalisation } from "@/features/orders/lib/checkout-draft";

/**
 * THE PERSONALIZE SCREEN'S ANSWERS, AND THE TWO SCHEMAS THAT STRIP.
 *
 * `orderNotes` — one optional string — passes through twelve hand-written
 * places: the draft type, the quote request, the quote schema, the controller,
 * the draft repository, its Mongoose model, the placed-order type, the
 * placement schema, the order service, the order model, the webhook's rebuild,
 * and the read-backs. Occasion, message, sender and consent as four separate
 * scalars would have been four more trips through all of that, and this repo
 * already carries a note about what happens next: one of the twelve gets
 * missed, and the field vanishes without a word.
 *
 * So they travel as one object, and the two places that would drop it in
 * silence are pinned here:
 *
 *  - `quoteSchema` has no `.passthrough()`, and the draft it writes is what the
 *    Razorpay webhook rebuilds an order from when the customer closes the tab
 *    after paying. Anything stripped there is gone for that customer only.
 *  - `placeOrderSchema` takes Zod's default `.strip()` at the TOP level — which
 *    is deliberate, so the client may keep sending fields the server no longer
 *    wants. The cost is that a top-level field wired everywhere except there is
 *    dropped on the way into the order, with a 200 and no message.
 *
 * The draft repository is the third: it accepted `personalisation` in its
 * context type and did not write it to the document. That one compiles, types
 * cleanly, and loses everything.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const PERSONALISATION: OrderPersonalisation = {
  occasion: "Anniversary",
  message: "Happy anniversary, both of you.",
  sender: { name: "Om Suman", phone: "7627014106", hideFromRecipient: true },
  termsAcceptedAt: "2026-09-11T10:30:00.000Z",
};

const ADDRESS = {
  fullName: "Asha",
  email: "asha@example.com",
  phone: "9000000000",
  addressLine1: "12 Probe Lane",
  city: "Mumbai",
  state: "MH",
  pincode: "400001",
};

describe("the quote carries it, so a closed tab loses nothing", () => {
  it("keeps every part of it", () => {
    const parsed = quoteSchema.parse({
      items: [{ productSlug: "cotton-tee", quantity: 1 }],
      address: ADDRESS,
      personalisation: PERSONALISATION,
    });

    expect(parsed.personalisation).toEqual(PERSONALISATION);
  });

  it("and the draft row actually stores it", () => {
    /**
     * The failure that types cannot catch: `createDraft` took
     * `personalisation` in its context and never put it in the document it
     * created. Everything compiled; every field was lost.
     */
    const repo = read("features/checkout/server/draft.repository.ts");
    const create = repo.slice(repo.indexOf("export async function createDraft"));

    expect(create.slice(0, create.indexOf("return toDraft"))).toContain(
      "personalisation: context.personalisation",
    );
  });

  it("and the webhook reads it back out when the browser never returns", () => {
    const webhook = read("app/api/razorpay/webhook/route.ts");

    expect(webhook).toContain("personalisation: (draft.personalisation ?? undefined)");
  });
});

describe("placement carries it too, and bounds every string", () => {
  const order = {
    items: [{ productSlug: "cotton-tee", name: "Cotton Tee", price: 800, quantity: 1 }],
    totals: { subtotal: 800, total: 800, itemCount: 1 },
    address: ADDRESS,
    paymentMethod: "cod" as const,
  };

  it("is not stripped at the top level", () => {
    const parsed = placeOrderSchema.parse({ ...order, personalisation: PERSONALISATION });

    expect(parsed.personalisation).toEqual(PERSONALISATION);
  });

  it("refuses a message long enough to be a payload", () => {
    expect(() =>
      placeOrderSchema.parse({
        ...order,
        personalisation: { message: "x".repeat(900) },
      }),
    ).toThrow();
  });

  it("refuses a sender name long enough to be a payload", () => {
    expect(() =>
      placeOrderSchema.parse({
        ...order,
        personalisation: { sender: { name: "x".repeat(300), phone: "9000000000" } },
      }),
    ).toThrow();
  });

  it("and an order with none of it is still a valid order", () => {
    // Every part is optional, and orders placed before the screen existed have
    // none of it at all.
    expect(placeOrderSchema.parse(order).personalisation).toBeUndefined();
  });
});

describe("the occasion is the shop's own word", () => {
  const page = read("apps/website/checkout/pages/checkout-page.tsx");

  it("comes from what the shop tagged, not from a list this code invented", () => {
    /**
     * Birthday / Anniversary / Other is a claim about what a shop sells and
     * who for. A florist's occasions are not a baker's, and this CMS is sold
     * to both.
     */
    expect(page).toContain("product.occasions ?? []");
    expect(page).not.toContain('occasionOptions = ["Birthday"');
  });

  it("and a shop that has tagged nothing is asked nothing", () => {
    // An empty row of buttons is worse than no row.
    expect(page).toContain("{occasionOptions.length > 0 ? (");
  });

  it("stays out of the schema as an enum, for the same reason", () => {
    const validators = read("features/orders/server/order.validators.ts");
    const block = validators.slice(validators.indexOf("personalisation: z"));

    expect(block.slice(0, 400)).toContain("occasion: z.string().trim().max(60).optional()");
  });
});

describe("the terms tick is a control, not a caption", () => {
  const page = read("apps/website/checkout/pages/checkout-page.tsx");

  it("gates the button that takes the money", () => {
    /**
     * It was a centred grey sentence saying agreement had already happened by
     * virtue of pressing the button beside it. Nothing was ticked and nothing
     * was recorded.
     */
    expect(page).toContain("!termsAccepted ||");
    expect(page).toContain("Accept the terms above to continue");
  });

  it("records when, not that a page once contained the words", () => {
    expect(page).toContain("termsAcceptedAt: termsAccepted ? new Date().toISOString() : undefined");
  });

  it("starts unticked, because a pre-ticked box records the same nothing", () => {
    expect(page).toContain("const [termsAccepted, setTermsAccepted] = useState(false);");
  });
});
