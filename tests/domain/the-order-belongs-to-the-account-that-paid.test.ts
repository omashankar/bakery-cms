/**
 * ONE FIELD DECIDED WHOSE ORDER IT WAS, AND IT LOOKED LIKE A CONTACT DETAIL.
 *
 * Traced down the stack rather than assumed:
 *
 *   app/api/customer-auth/orders/route.ts   -> myOrdersController
 *   customer-auth.controller.ts             -> getByCustomer(customer.email)
 *   orders/server/order.service.ts          -> repo.findByCustomerEmail(email)
 *   orders/server/order.repository.ts       -> find({ "address.email": … })
 *
 * "My orders" matches the SESSION's email against each order's
 * `address.email`. That field was an input in the checkout address form,
 * labelled plainly "Email", inside a card headed "New delivery address",
 * under "Where should we deliver your order?".
 *
 * So a buyer sending a gift could read it as the delivery contact and type
 * the RECIPIENT's. The order is still placed, the shop still has it, the
 * money is still taken — and it never appears in the buyer's own order
 * list, because the key it is found by is now somebody else's address. The
 * one line that contradicts the reading ("We will use these to reach you
 * about this order") is two steps further on.
 *
 * It could change three ways and all three are closed:
 *   TYPED    — it is no longer an input; the account email is read back as
 *              text, outside the per-destination card, with the form
 *              registration kept mounted so the value still submits.
 *   PICKED   — `toCheckoutAddress` copied `saved.email`, and the address
 *              book stores an email per address, so choosing a different
 *              destination silently reassigned the order.
 *   RESTORED — the draft reset preferred `draft.address.email` over the
 *              session, so a wrong value typed before the fix survived it.
 *
 * Measured after, on a signed-in walk: the address step has ten inputs and
 * no email among them, "Ordering as" shows the account address above the
 * picker, and the payment step's Review reads that same address back.
 *
 * THE FIRST CASE BELOW IS THE LOAD-BEARING ONE. Everything here is only
 * worth doing because the repository keys on `address.email`; if that ever
 * changes, this file should be re-read rather than kept green.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CHECKOUT = "apps/website/checkout/pages/checkout-page.tsx";
const REPO = "features/orders/server/order.repository.ts";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/** Source with comments stripped — the rules below are about what renders. */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

describe("why this field is not a contact detail", () => {
  it("a customer's orders are found by the address email on the order", () => {
    /*
      THE PREMISE OF THE WHOLE FILE. If the lookup stops keying on
      `address.email` — if an account id is stored on the order instead —
      then pinning this field is no longer load-bearing and the rest of
      these rules should be reconsidered rather than satisfied.
    */
    const repo = code(REPO);
    const at = repo.indexOf("export async function findByCustomerEmail");
    expect(at, "findByCustomerEmail is gone — re-read this file").toBeGreaterThan(-1);

    /*
      SCOPED TO THAT FUNCTION, and the first draft was not — it asked the
      whole file for `"address.email"` and passed while the lookup had been
      rewritten, because a DIFFERENT query further down the same file also
      matches on that path. The mutation run caught it: the case stayed
      green with the real query replaced.
    */
    const body = repo.slice(at, repo.indexOf("\n}", at));
    expect(body, "the customer order lookup no longer keys on the address email").toContain(
      '"address.email"',
    );
  });
});

describe("so the account email cannot be typed over", () => {
  const src = code(CHECKOUT);

  it("the address form has no email input in it", () => {
    /*
      SCOPED TO THE CONTROL, not the word. "email" appears all over this
      file — the type, the draft, the reset — so searching for it would
      answer a different question. What must not come back is an editable
      control bound to the field.
    */
    expect(src, "an editable email control is back in the checkout form").not.toMatch(
      /<Input\b[^>]*\bid="email"/,
    );
    expect(src, 'the form still labels an email field for typing').not.toMatch(
      /htmlFor="email"/,
    );
  });

  it("but the value still reaches the order", () => {
    /*
      A FIELD REMOVED FROM THE FORM IS A FIELD REMOVED FROM THE SUBMISSION.
      The registration stays mounted on a hidden input, or the order is
      written with no email at all and nobody's list finds it.
    */
    expect(src, "the email registration is gone — the order will carry none").toMatch(
      /<input type="hidden" \{\.\.\.register\("email"\)\} \/>/,
    );
  });

  it("and the buyer can see whose order it is", () => {
    expect(src, "nothing on the page says which account the order belongs to").toContain(
      "Ordering as",
    );
    expect(src, "the line does not read the account email").toMatch(
      /Ordering as[\s\S]{0,200}\{accountEmail\}/,
    );
  });
});

describe("nor picked over", () => {
  const src = code(CHECKOUT);

  it("choosing a saved address does not bring its own email with it", () => {
    /*
      The address book stores an email per address, so this is not
      hypothetical: a buyer with two saved addresses had two identities,
      and which one the order belonged to depended on which destination
      they clicked.
    */
    const fn = src.slice(src.indexOf("function toCheckoutAddress"));
    const body = fn.slice(0, fn.indexOf("}\n"));
    expect(body, "toCheckoutAddress stopped taking the account email").toContain("accountEmail");
    expect(body, "the saved address's own email is back in the form").not.toContain("saved.email");
  });

  it("and every call site hands it one", () => {
    /*
      A one-argument call is a type error today, which is the point of
      making the parameter required rather than optional — but an optional
      second argument would compile and silently restore the bug, so the
      shape is asserted here too.
    */
    const calls = [...src.matchAll(/toCheckoutAddress\(([^)]*)\)/g)]
      .map((m) => m[1].trim())
      .filter((args) => args && !args.startsWith("saved: SavedAddress"));
    expect(calls.length, "no call sites found — the scan is dead").toBeGreaterThan(2);
    for (const args of calls) {
      expect(args, `toCheckoutAddress(${args}) passes no account email`).toMatch(/,/);
    }
  });
});

describe("nor restored over", () => {
  const src = code(CHECKOUT);

  it("the session outranks whatever the draft is holding", () => {
    /*
      The draft may hold a destination. It does not get to hold an
      identity: a recipient's address typed before this fix would otherwise
      be restored on top of the session on the next visit, and survive the
      fix entirely.
    */
    expect(src, "the draft's email is preferred over the session again").not.toContain(
      'draft.address.email || session?.email',
    );
    expect(src, "the session is no longer the first choice for the email").toContain(
      'email: session?.email || draft.address.email || ""',
    );
  });
});
