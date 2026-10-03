"use client";

import { useEffect, useState } from "react";
import { MapPin, X } from "lucide-react";

import { DeliveryAnswer } from "@/components/storefront/delivery-answer";
import { fetchZones } from "@/features/commerce/lib/commerce-api";
import {
  lookUpDeliveryPincode,
  readDeliveryLocation,
  saveDeliveryLocation,
  type DeliveryLookup,
} from "@/features/commerce/lib/delivery-location";
import { normalizePincode } from "@/features/commerce/lib/delivery-zone-utils";
import type { DeliveryZone } from "@/types/delivery";
import { cn } from "@/lib/utils";

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
export function PincodeCheck({ className }: { className?: string }) {
  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  const [entered, setEntered] = useState("");
  const [result, setResult] = useState<DeliveryLookup | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchZones()
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

  if (zones === null || zones.length === 0) return null;

  const check = () => {
    setChecking(true);
    const found = lookUpDeliveryPincode(zones, entered);
    setResult(found);
    setChecking(false);
    if (found?.served) {
      saveDeliveryLocation({ pincode: normalizePincode(entered), label: found.zoneName });
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
      {/*
        ONE CONTROL, NOT TWO BOXES WITH A GAP.

        It was an `<Input>` and a `<Button>` side by side, each with its own
        border and rounding and four pixels of nothing between them — which
        reads as a field and, separately, a button that happens to sit near it.
        The shop pointed at its reference twice: there the button is joined to
        the field, sharing one outline, so the pair reads as the single question
        it is.

        Built here rather than with `<Input>` and `<Button>`: both carry their
        own border, radius and focus ring, and stripping those off through
        `className` is a fight with the design system that the next person to
        touch either component loses. The focus ring moves to the GROUP, via
        `focus-within`, so tabbing into the field still lights the whole control
        the way every other input on this page lights itself.
      */}
      <form
        className={cn(
          "flex h-12 w-full min-w-0 overflow-hidden rounded-md border bg-card",
          outline,
        )}
        onSubmit={(event) => {
          event.preventDefault();
          check();
        }}
      >
        <MapPin
          className="ml-3 size-4 shrink-0 self-center text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="text"
          value={entered}
          // The same normalisation every zone rule is matched through, so what
          // the customer sees typed is exactly what gets compared.
          onChange={(event) => {
            setEntered(normalizePincode(event.target.value));
            // The old answer belonged to the old code. Left up, it reads as the
            // answer to what is in the box now — and so does a green border.
            setResult(null);
          }}
          inputMode="numeric"
          autoComplete="postal-code"
          aria-label="PIN code"
          placeholder="Enter PIN code to check delivery"
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
          className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-base outline-none md:text-sm placeholder:text-muted-foreground"
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
          disabled={!entered}
          className="h-full shrink-0 bg-bakery-700 px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Check
        </button>
      </form>

      {/*
        UNDER THE FIELD, because the field is now level with every other
        control in this column and has nothing to its right. It still must not
        push Add to Cart down as it appears — the button a customer is reaching
        for should not move while they read — so the gap below is reserved by
        the row spacing rather than created by the answer.
      */}
      <DeliveryAnswer
        result={result}
        pincode={entered}
        loading={checking}
      />
    </div>
  );
}
