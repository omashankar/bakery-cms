/**
 * THE LAST BUTTON IN THE SHOP WAS GREY, AND THE REASON COULD NOT BE SEEN.
 *
 * Captured on a signed-in walk to the payment step, at 390 and at 1440:
 * `{"label":"Place order · ₹1,784","disabled":true}`, with no error text
 * anywhere on the screen. The buyer had filled an address, picked a slot and
 * picked a payment method, and the last control was dead.
 *
 * The gate was `!termsAccepted`, and the only stated reason was
 * `title="Accept the terms above to continue"`.
 *
 * THAT TITLE COULD NEVER RENDER. `components/ui/button.tsx` carries
 * `disabled:pointer-events-none`, so a disabled button is not a hit target:
 * no hover, no tooltip, on a desktop or a phone. The comment beside the gate
 * — "`title` because a disabled control that does not say why is the worst
 * kind" — described a cure that never reached the screen, which is exactly
 * how it survived review.
 *
 * The shop's own consent wording made it worse. On this shop it reads "By
 * placing this order you agree to our delivery terms…", which is phrased as
 * a consequence of pressing the button, not an instruction to tick anything.
 * So the one control that unlocked the purchase was the one the words told
 * the buyer to ignore.
 *
 * WHAT REPLACED IT is the pattern already in the same file: the delivery
 * slot does not disable its button either. It refuses in the handler, writes
 * an error into state, and renders `role="alert"` beside the field with
 * `aria-invalid` on the control. The consent box now does the same, with the
 * message that was already in the file as the title value — not one new
 * word.
 *
 * Measured after, at 390: the button is enabled; one press with the box
 * unticked puts "Accept the terms above to continue" on screen 40px under
 * the box, moves focus to the box, sets `aria-invalid="true"`, and stays on
 * `?step=3` with no order written; ticking the box clears both.
 *
 * WHAT THIS FILE CANNOT DO is measure any of that — it reads source. What it
 * holds is the shape the measurement depended on, because every part of it
 * looks removable: a gate looks like a safety check, an alert looks like
 * clutter, and a ref looks like it could be an id.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const CHECKOUT = "apps/website/checkout/pages/checkout-page.tsx";
const BUTTON = "components/ui/button.tsx";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/** A function body, from its opening line to the end of the file. */
function from(source: string, signature: string): string {
  const at = source.indexOf(signature);
  if (at === -1) throw new Error(`could not find ${signature}`);
  return source.slice(at);
}

/** The `disabled={…}` expression on the place-order button, and nothing else. */
function placeOrderGate(source: string): string {
  const at = source.indexOf("onClick={onPlaceOrder}");
  if (at === -1) throw new Error("the place-order button is gone");
  const tail = source.slice(at);
  const open = tail.indexOf("disabled={");
  if (open === -1) throw new Error("the place-order button has no disabled expression");
  /* Walk the braces so a nested `(…)` or `{…}` cannot end the scan early. */
  let depth = 0;
  for (let i = open + "disabled=".length; i < tail.length; i += 1) {
    if (tail[i] === "{") depth += 1;
    else if (tail[i] === "}") {
      depth -= 1;
      if (depth === 0) return tail.slice(open, i + 1);
    }
  }
  throw new Error("could not read the disabled expression");
}

describe("the button that places the order", () => {
  const src = read(CHECKOUT);

  it("is not greyed out by the one thing the customer cannot see", () => {
    /*
      SCOPED TO THE EXPRESSION, not the file. `termsAccepted` appears all
      over this page — the state, the handler, the checkbox — so
      `expect(src).not.toContain("!termsAccepted")` would be answering a
      different question and would pass the moment the gate came back with
      a space in it.
    */
    const gate = placeOrderGate(src);
    expect(gate, "the consent tick greys the button again — and nothing on screen says so").not.toMatch(
      /!\s*termsAccepted/,
    );
  });

  it("is still greyed out by the three things the customer CAN see", () => {
    /*
      THE POINT IS NOT "NEVER DISABLE IT". `placing` shows a spinner in this
      button, `cartBlocked` draws the CartIssuesAlert above it, and the
      minimum-order clause draws its own alert. Each of those greys the
      button AND says why, without a pointer. Removing them would be the
      opposite mistake.
    */
    const gate = placeOrderGate(src);
    for (const reason of ["placing", "cartBlocked", "minOrderValue"]) {
      expect(gate, `the place-order button stopped waiting on ${reason}`).toContain(reason);
    }
  });

  it("and no longer explains itself through a tooltip that cannot fire", () => {
    /*
      THE REASON THE OLD CURE FAILED, pinned so it cannot be reintroduced.
      A disabled button has `pointer-events-none` from the shared class, so
      it never receives hover and `title` never renders.
    */
    expect(read(BUTTON), "the shared button no longer has pointer-events-none — recheck this whole file").toContain(
      "disabled:pointer-events-none",
    );
    const gate = src.slice(src.indexOf("onClick={onPlaceOrder}"), src.indexOf("onClick={onPlaceOrder}") + 1800);
    expect(gate, "a title is back on the place-order button, where it cannot be read").not.toMatch(
      /\btitle=\{/,
    );
  });
});

describe("so the refusal happens where it can be read", () => {
  const src = read(CHECKOUT);
  const handler = from(src, "const onPlaceOrder = async () => {");

  it("the handler turns the press down, before it prices anything", () => {
    /*
      IT HAS TO BE ENFORCED SOMEWHERE. The order stores `termsAcceptedAt`
      from this flag, so an enabled button with no check would write an
      order with no consent behind it.

      And before `requestCartQuote`: there is no reason to ask the server
      what the order costs when it is not going to be placed.
    */
    const refusal = handler.indexOf("if (!termsAccepted)");
    const quote = handler.indexOf("requestCartQuote");
    expect(refusal, "nothing stops a press with the box unticked").toBeGreaterThan(-1);
    expect(quote, "the quote call is gone — this check is out of date").toBeGreaterThan(-1);
    expect(refusal, "the consent check runs after the cart is priced").toBeLessThan(quote);
  });

  it("and says the same words the dead tooltip used to hold", () => {
    /*
      NOT ONE NEW WORD. The string was already in the file as the title
      value; the fix moved it somewhere it can be seen rather than writing
      a new sentence on the shop's behalf.
    */
    expect(handler.slice(0, 1200), "the refusal message changed").toContain(
      '"Accept the terms above to continue"',
    );
  });

  it("and moves focus to the visible box, not the hidden input behind it", () => {
    /*
      THE FIRST VERSION OF THIS DID THE WRONG THING AND LOOKED RIGHT.
      Base UI puts `id="acceptTerms"` on the hidden input it renders for
      form submission, and that input is `tabindex="-1"` — focusing it
      moves focus nowhere a customer can see. Measured: the probe's own
      click on `#acceptTerms` timed out against
      `<input tabindex="-1" type="checkbox">`.
    */
    expect(handler.slice(0, 1200), "focus is aimed at the hidden input again").not.toContain(
      'getElementById("acceptTerms")',
    );
    expect(handler.slice(0, 1200), "focus no longer moves to the box that refused").toContain(
      "termsBoxRef.current?.focus()",
    );
  });
});

describe("and the screen shows it", () => {
  const src = read(CHECKOUT);

  it("as an alert under the box, in the house style", () => {
    expect(src, "the refusal has no element to render into").toContain('id="acceptTermsError"');
    expect(src, "the refusal is not announced").toMatch(/id="acceptTermsError"[\s\S]{0,120}role="alert"/);
    expect(src, "the refusal is not styled as one").toMatch(
      /id="acceptTermsError"[\s\S]{0,200}text-destructive/,
    );
  });

  it("with the box marked invalid and pointing at the message", () => {
    const box = src.slice(src.indexOf('id="acceptTerms"'), src.indexOf('id="acceptTerms"') + 700);
    expect(box, "the box is not marked invalid when it refuses").toContain(
      "aria-invalid={Boolean(termsError)}",
    );
    expect(box, "the box does not point at the message").toContain("aria-describedby");
    expect(box, "the ref the handler focuses is not attached").toContain("ref={termsBoxRef}");
  });

  it("and clears the moment the box is ticked", () => {
    /*
      Or the red line outlives the correction that answered it, which is
      its own small confusion at the last step of a purchase.
    */
    const box = src.slice(src.indexOf('id="acceptTerms"'), src.indexOf('id="acceptTerms"') + 900);
    expect(box, "ticking the box leaves the refusal on screen").toMatch(
      /onCheckedChange[\s\S]{0,220}setTermsError\(null\)/,
    );
  });
});

describe("the way back out of the payment step", () => {
  /*
    COMMENTS STRIPPED, and the first run of this file is why. The fix's own
    docblock explains what "Back to payment" used to do and why it went — so
    a file-wide search for that string matched the explanation and failed the
    case. A rule about what the shop RENDERS has to be asked of the code.
  */
  const src = read(CHECKOUT)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  it("does not name the step the customer is standing on", () => {
    /*
      It said "Back to payment" while ON the payment screen, and went to
      Personalize. Two wrong turns in one label — and while "Place order"
      arrived grey it was the only enabled control in that row, so it is
      what a stuck buyer pressed.
    */
    expect(src, '"Back to payment" is back on the payment step').not.toContain("Back to payment");
  });

  it("and says what the step before it says", () => {
    /*
      Only the first step names its destination — "Back to cart" — because
      that one leaves the checkout route. The inner steps say "Back".
    */
    expect(src, "the first step stopped naming the route it leaves for").toContain("Back to cart");
    const backs = [...src.matchAll(/>\s*Back\s*</g)];
    expect(backs.length, "the two inner steps no longer share one back label").toBeGreaterThanOrEqual(2);
  });
});
