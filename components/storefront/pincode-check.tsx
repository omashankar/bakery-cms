"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";

import { DeliveryAnswer } from "@/components/storefront/delivery-answer";
import { answerPinByArea } from "@/components/storefront/pin-area-answer";
import { fetchZones } from "@/features/commerce/lib/commerce-api";
import { fetchPincodePlace } from "@/features/commerce/lib/pincode-api";
import { loadDeliveryZones } from "@/features/commerce/lib/delivery-zones-repository";
import { isStorefrontSeeded } from "@/lib/storefront-seed-flag";
import {
  lookUpDeliveryPincode,
  pincodeLabel,
  readDeliveryLocation,
  saveDeliveryLocation,
  type DeliveryLookup,
} from "@/features/commerce/lib/delivery-location";
import { isFullPincode, normalizePincode } from "@/features/commerce/lib/delivery-zone-utils";
import type { DeliveryZone } from "@/types/delivery";
import { cn } from "@/lib/utils";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";

/**
 * CAN IT REACH ME — asked on the page where the customer is deciding.
 *
 * The shop asked for this by pointing at the storefront it is drawn from, where
 * the row sits between the message box and Add to Cart. It is the last question
 * before somebody commits: a customer who adds to cart, fills in a delivery
 * address and is told at checkout that nothing covers their PIN code has spent
 * five minutes to be turned away, and most of them do not come back to try a
 * different product.
 *
 * IT RENDERS NOTHING FOR A SHOP WITH NO ZONES, and that gate is the whole
 * reason it fetches on mount rather than on first keystroke. The header's
 * popover can afford to wait — it is behind a click, and a control nobody
 * opens costs nothing. This one is in the page, so the choice is between one
 * small public request per product view and offering a delivery checker that
 * can only ever answer "no area covers this", which is a worse answer than no
 * control. The distinction matters: a shop that has not set its zones up yet
 * has said nothing about where it delivers, and this must not put words in its
 * mouth.
 *
 * A CHECK HERE IS THE SAME CHECK AS THE HEADER'S. It reads and writes the same
 * saved location, so a code entered here fills in the header's pill and is
 * still there at checkout — and the answer is rendered by the same
 * `DeliveryAnswer`, so the two screens cannot come to word it differently.
 */
export function PincodeCheck({
  className,
  title,
  inline = false,
}: {
  className?: string;
  /**
   * A heading drawn INSIDE, so it goes away with the control — a shop with no
   * zones renders nothing here, and a caller's own heading would be left
   * over an empty box.
   */
  title?: string;
  /**
   * The title BESIDE the field on a wide screen — one slim row, as the
   * reference's cart has it ("Enter Delivery Pincode: [ ] Check") — rather
   * than a heading over a full-width box.
   */
  inline?: boolean;
}) {
  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  const [entered, setEntered] = useState("");
  // Bumped on every edit, so a check answered after the box changed is dropped.
  const checkSeq = useRef(0);
  const [result, setResult] = useState<DeliveryLookup | null>(null);
  const [checking, setChecking] = useState(false);
  // Inline only: the field, or the settled "Deliver to 324001 · Change" row.
  const [editing, setEditing] = useState(true);

  useEffect(() => {
    let alive = true;
    // The zones the page brought with it (StorefrontCacheSeed), or a request.
    const read = isStorefrontSeeded() ? Promise.resolve(loadDeliveryZones()) : fetchZones();
    void read
      // An empty list on failure rather than a retry loop — the control then
      // simply does not mount, which is the same as a shop with no zones and
      // is the quiet failure rather than a loud wrong claim.
      .then((rows) => alive && setZones(rows ?? []))
      .catch(() => alive && setZones([]));
    return () => {
      alive = false;
    };
  }, []);

  /*
    A code the customer entered earlier — in the header, or on another product
    — is filled in, but NOT answered. Showing "Delivered in Kota" for a code
    they cannot see the input of is the page claiming to have checked something
    it has not; they press Check and it answers.

    IN AN EFFECT, and the lint rule against that cannot be satisfied here. The
    obvious alternative is a lazy initialiser — `useState(() => readDelivery…)`
    — which runs during render, and `readDeliveryLocation` reads localStorage,
    which the server does not have. The first client render would then disagree
    with the HTML and React would throw the whole tree away. A second render is
    the cost of reading the browser at all.
  */
  useEffect(() => {
    const saved = readDeliveryLocation();
    if (saved?.pincode) setEntered(saved.pincode);
  }, []);

  useEffect(() => {
    if (!inline || !zones || zones.length === 0) return;
    const saved = readDeliveryLocation();
    if (!saved?.pincode) return;
    let alive = true;
    // The real place too, so a district zone answers here as checkout will.
    void fetchPincodePlace(saved.pincode).then(async (asked) => {
      if (!alive) return;
      const lookup = lookUpDeliveryPincode(zones, saved.pincode, getCommerceSettings(), asked?.place);
      // A plain yes or no, even for a shop that delivers by map area.
      const found = await answerPinByArea(lookup, saved.pincode);
      if (!alive) return;
      setResult(found);
      if (found?.served) setEditing(false);
    });
    return () => {
      alive = false;
    };
  }, [inline, zones]);

  if (zones === null || zones.length === 0) return null;

  const check = async () => {
    const code = normalizePincode(entered);
    const seq = ++checkSeq.current;
    setChecking(true);
    // India Post's answer: where the PIN is, or that there is no such PIN.
    // A failed request answers from the zones alone, never "not a PIN".
    const asked = await fetchPincodePlace(code);
    // A plain yes or no, as this box always gave — even where the shop
    // delivers by map area (owner, 2026-10-27). See `answerPinByArea`.
    const found = await answerPinByArea(lookUpDeliveryPincode(zones, code, getCommerceSettings(), asked?.place), code);
    setChecking(false);
    // Typed over while the answer was on its way: that answer is not for this box.
    if (seq !== checkSeq.current) return;
    setResult(found);
    if (found?.served) {
      saveDeliveryLocation({ pincode: normalizePincode(entered), label: pincodeLabel(normalizePincode(entered), asked?.place) });
      if (inline) setEditing(false);
    }
  };

  /*
    THE BORDER CARRIES THE ANSWER TOO, and it is deliberately a SECOND signal
    rather than the only one. Green and red alone would say nothing to a
    customer who cannot tell them apart — roughly one man in twelve — so the
    tick, the cross and the sentence beside them each carry the same answer on
    their own. The colour is what makes it readable at a glance for everyone
    else.
  */
  const outline =
    result === null
      ? "border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50"
      : result.served
        ? "border-green-600"
        : "border-destructive";

  if (inline && !editing && result?.served) {
    return (
      <div
        className={cn("flex w-full min-w-0 items-center justify-between gap-3", className)}
        aria-live="polite"
      >
        <p className="flex min-w-0 items-center gap-2 text-sm">
          <MapPin className="size-4 shrink-0 text-bakery-700" aria-hidden="true" />
          <span className="shrink-0 whitespace-nowrap text-muted-foreground">Deliver to:</span>
          <span className="shrink-0 font-semibold text-foreground">{normalizePincode(entered)}</span>
          {result.place?.districts[0] ? (
            <span className="truncate text-muted-foreground">· {result.place.districts[0]}</span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Change PIN code"
          className="h-9 shrink-0 rounded-md border border-bakery-700 px-3 text-sm font-semibold text-bakery-700 transition-colors hover:bg-bakery-50"
        >
          {/* "Change" on a phone: the full label pushed the code onto two lines. */}
          <span className="sm:hidden">Change</span>
          <span className="hidden sm:inline">Change PIN code</span>
        </button>
      </div>
    );
  }

  /*
    ONE CONTROL, NOT TWO BOXES WITH A GAP.

    It was an `<Input>` and a `<Button>` side by side, each with its own
    border and rounding and four pixels of nothing between them — which
    reads as a field and, separately, a button that happens to sit near it.
    The shop pointed at its reference twice: there the button is joined to
    the field, sharing one outline, so the pair reads as the single question
    it is. The cart's row is joined the same way now: as a grey field and a
    separate outlined button it read as two loose controls in an empty card.

    Built here rather than with `<Input>` and `<Button>`: both carry their
    own border, radius and focus ring, and stripping those off through
    `className` is a fight with the design system that the next person to
    touch either component loses. The focus ring moves to the GROUP, via
    `focus-within`, so tabbing into the field still lights the whole control
    the way every other input on this page lights itself.
  */
  const field = (
    <form
      className={cn(
        "flex w-full min-w-0 overflow-hidden rounded-md border bg-card",
        inline ? "h-11" : "h-12",
        outline,
      )}
      onSubmit={(event) => {
        event.preventDefault();
        void check();
      }}
    >
      {inline ? null : (
        <MapPin
          className="ml-3 size-4 shrink-0 self-center text-muted-foreground"
          aria-hidden="true"
        />
      )}
      <input
        type="text"
        value={entered}
        // The same normalisation every zone rule is matched through, so what
        // the customer sees typed is exactly what gets compared.
        onChange={(event) => {
          checkSeq.current += 1;
          setEntered(normalizePincode(event.target.value));
          // The old answer belonged to the old code. Left up, it reads as the
          // answer to what is in the box now — and so does a green border.
          setResult(null);
        }}
        inputMode="numeric"
        autoComplete="postal-code"
        aria-label="PIN code"
        // Short enough to read whole at 390px; it was cut to "check deliv…".
        placeholder="Enter delivery PIN code"
        /*
          `size={1}`, AND IT IS NOT ABOUT THE RENDERED WIDTH — the CSS below
          sets that. `size` sets an input's INTRINSIC width, and its default
          of 20 characters made this field's min-content about 211px. The
          column it sits in is a GRID item, whose automatic minimum is its
          own min-content, so the column refused to go narrower than
          28 (the icon) + 211 + 93 (the Check button) = 332 — and at a 320px
          window, where the track is 288, it simply overhung by 44 and gave
          the whole page a sideways scrollbar.

          `min-w-0` on the input does not cure that: it lets the input shrink
          as a FLEX item, which is why the field itself was never the thing
          overflowing, while the column's min-content was still computed from
          the same twenty characters. Measured: 28px of sideways scroll at
          320 with this absent, 0 with it, and no change at all at 375 and
          above, where the track was already wider than 332.
        */
        size={1}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent px-2.5 text-base outline-none md:text-sm placeholder:text-muted-foreground",
          inline && "pl-3",
        )}
      />
      {/*
        A WAY OUT OF A WRONG CODE, which the field did not have. Six digits
        typed by thumb are six digits to delete by thumb, and a customer who
        got a red border has every reason to want the box empty at once.

        `type="button"`, or it submits the form it sits inside — the default
        for a button in a form is submit, and the bug that produces is a
        clear that checks the code it has just erased.
      */}
      {entered ? (
        <button
          type="button"
          onClick={() => {
            checkSeq.current += 1;
            setEntered("");
            setResult(null);
          }}
          aria-label="Clear PIN code"
          className="mr-1 shrink-0 self-center rounded-full p-1 text-muted-foreground"
        >
          <X className="size-4" />
        </button>
      ) : null}
      <button
        type="submit"
        // Six digits or nothing to check — a prefix used to answer "yes".
        disabled={!isFullPincode(entered)}
        className={cn(
          "h-full shrink-0 px-6 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50",
          // Inline it is an outlined segment, not a filled block: filled, it
          // looked disabled until a code was typed in.
          inline
            ? "border-l border-input text-bakery-700 hover:bg-bakery-50"
            : "bg-bakery-700 text-white",
        )}
      >
        Check
      </button>
    </form>
  );

  // PIN only here, a yes or a no (owner, 2026-10-27): the exact door is checked on checkout's map.
  const answer = <DeliveryAnswer result={result} pincode={entered} loading={checking} exactCheck={false} />;

  if (inline) {
    return (
      /*
        THE QUESTION ON THE LEFT, THE FIELD ON THE RIGHT, and the answer takes
        the question's place.

        It was a label, a field and a separate button in a row with half the
        card empty after them, and the answer added a line under the field — so
        the card changed height on every check and nothing in it lined up with
        the cart line below. Now the two halves fill the row the way the cart
        line's name and price do, and the left half always holds two lines (the
        prompt, or the answer and its place), so the card holds still while the
        customer checks.
      */
      <div
        className={cn(
          "flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
          className,
        )}
      >
        <div className="flex min-h-10 min-w-0 items-center sm:flex-1" aria-live="polite">
          {result !== null || checking ? (
            answer
          ) : (
            <div className="flex min-w-0 items-start gap-2 text-sm">
              <MapPin className="mt-0.5 size-4 shrink-0 text-bakery-700" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-medium text-foreground">{title}</p>
                <p className="text-muted-foreground">See if we deliver to you before you order</p>
              </div>
            </div>
          )}
        </div>
        <div className="w-full shrink-0 sm:w-80">{field}</div>
      </div>
    );
  }

  return (
    /*
      THE FIELD IS AS WIDE AS EVERY OTHER CONTROL IN THIS COLUMN, and the
      answer sits UNDER it.

      It was `sm:max-w-sm` with the answer beside it, which is what the shop
      asked for when it was looking at this row on its own. Seen with the rest
      of the column it was the one thing out of line: the message box and the
      upload run the full width, the Add to Cart row runs the full width, and
      this stopped at 384px — three different right-hand edges down one short
      stack, which is the first thing the eye finds and cannot un-see.

      Alignment wins because it is about the whole column and "beside" was
      about one row. They genuinely cannot both hold: a field level with the
      others leaves nothing to its right to put an answer in.
    */
    <div className={cn("flex w-full min-w-0 flex-col gap-2", className)}>
      {title ? <p className="text-sm font-medium text-foreground">{title}</p> : null}
      {field}
      {/*
        UNDER THE FIELD, because the field is now level with every other
        control in this column and has nothing to its right. It still must not
        push Add to Cart down as it appears — the button a customer is reaching
        for should not move while they read — so the gap below is reserved by
        the row spacing rather than created by the answer.
      */}
      {answer}
    </div>
  );
}
