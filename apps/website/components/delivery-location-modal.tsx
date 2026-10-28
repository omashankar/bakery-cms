"use client";

import { useId, useRef, useState } from "react";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DeliveryAnswer } from "@/components/storefront/delivery-answer";
import { answerPinByArea } from "@/components/storefront/pin-area-answer";
import { PlaceSearch, type PlaceSuggestion } from "@/components/shared/place-search";
import { checkDeliverySpot, currentPosition, shortName, SpotAnswerView, type SpotAnswer } from "@/components/storefront/exact-address-check";
import { getSavedAddresses, type SavedAddress } from "@/apps/website/account/lib/customer-addresses";
import { getCustomerSession } from "@/apps/website/account/lib/customer-session";
import { openCustomerAuthModal } from "@/apps/website/account/lib/auth-modal-events";
import { fetchPincodePlace, fetchPincodeSuggestions } from "@/features/commerce/lib/pincode-api";
import {
  lookUpDeliveryPincode,
  pincodeLabel,
  saveDeliveryLocation,
  type DeliveryLookup,
} from "@/features/commerce/lib/delivery-location";
import { isFullPincode, normalizePincode } from "@/features/commerce/lib/delivery-zone-utils";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import type { DeliveryZone, PincodePlace } from "@/types/delivery";
import { cn } from "@/lib/utils";

/**
 * SELECT DELIVERY LOCATION — the reference shop's own window, in this shop.
 *
 * A PIN code, and only a PIN code, is what it checks (owner, 2026-10-28: "isme
 * bhi only pincode hi check hoga") — the same plain yes or no the product page
 * gives. Two ways to a PIN for a customer who does not know theirs: "Don't
 * Know Pincode?" finds their area and fills its PIN in; "Detect my location"
 * asks the shop about where the phone is. A signed-in customer can pick a
 * saved address.
 *
 * Loaded only when opened: the header is on every page, and this is not.
 */

type Result =
  | { kind: "pin"; pincode: string; lookup: DeliveryLookup | null }
  | { kind: "spot"; answer: SpotAnswer };

export default function DeliveryLocationModal({
  open,
  onOpenChange,
  zones,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The shop's zones, as the header loaded them. */
  zones: DeliveryZone[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [pincode, setPincode] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState("");
  const [findingPin, setFindingPin] = useState(false);
  // Read as the window opens: it is mounted fresh each time (see the header),
  // and never on the server, so the browser's session and book are there.
  const [signedIn] = useState(() => Boolean(getCustomerSession()));
  const [saved] = useState<SavedAddress[]>(() => (getCustomerSession() ? getSavedAddresses().slice(0, 4) : []));
  const checkSeq = useRef(0);
  // The real PINs the digits so far could be, as the reference shop lists them.
  const [suggestions, setSuggestions] = useState<PincodePlace[]>([]);
  // The digits the list was asked for — until it answers, an empty list is not "none".
  const [suggestedFor, setSuggestedFor] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const suggestSeq = useRef(0);

  function suggestFor(code: string) {
    const seq = ++suggestSeq.current;
    setActive(-1);
    // Three digits is where a list is short enough to read; six is checked, not listed.
    if (code.length < 3 || isFullPincode(code)) {
      setSuggestions([]);
      setListOpen(false);
      return;
    }
    setListOpen(true);
    void fetchPincodeSuggestions(code).then((list) => {
      if (seq !== suggestSeq.current) return;
      setSuggestions(list ?? []);
      setSuggestedFor(list ? code : "");
    });
  }

  function pickSuggestion(code: string) {
    suggestSeq.current += 1;
    setListOpen(false);
    setSuggestions([]);
    setPincode(code);
    void checkPin(code);
  }

  async function checkPin(code: string) {
    const seq = ++checkSeq.current;
    setResult({ kind: "pin", pincode: code, lookup: null });
    const asked = await fetchPincodePlace(code);
    if (seq !== checkSeq.current) return;
    // The same plain yes or no the product page gives for a PIN.
    const lookup = await answerPinByArea(lookUpDeliveryPincode(zones, code, getCommerceSettings(), asked?.place), code);
    if (seq !== checkSeq.current) return;
    setResult({ kind: "pin", pincode: code, lookup });
    if (lookup?.served) saveDeliveryLocation({ pincode: code, label: pincodeLabel(code, asked?.place) });
  }

  async function checkSpot(place: { location: { lat: number; lng: number }; label: string; area?: string; city?: string }) {
    const seq = ++checkSeq.current;
    setResult({ kind: "spot", answer: { status: "checking" } });
    const answer = await checkDeliverySpot(place.location, place.label, "", shortName(place));
    if (seq === checkSeq.current) setResult({ kind: "spot", answer });
  }

  /** "Don't Know Pincode?" — the area's PIN is filled in and checked, as if typed. */
  function takeFoundPlace(place: PlaceSuggestion) {
    setFindingPin(false);
    if (place.postalCode && isFullPincode(place.postalCode)) {
      setPincode(place.postalCode);
      void checkPin(place.postalCode);
      return;
    }
    // The map has no PIN for it: ask about the place itself instead.
    void checkSpot(place);
  }

  function detect() {
    setLocating(true);
    setNote("");
    void currentPosition()
      .then((point) => checkSpot({ location: point, label: "Your current location" }))
      .catch((error: Error) => setNote(error.message))
      .finally(() => setLocating(false));
  }

  const chosen =
    (result?.kind === "pin" && result.lookup?.served && !result.lookup.needsPin) ||
    (result?.kind === "spot" && result.answer.status === "yes");

  const showOr = !signedIn || saved.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next, details) => {
        // Escape with the PIN list showing closes the list, not the window —
        // the window hears the key on the document, before the box can stop it.
        if (!next && listOpen && details.reason === "escape-key") {
          details.cancel();
          setListOpen(false);
          return;
        }
        onOpenChange(next);
      }}
    >
      {/*
        Laid out as the reference shop's window is: a tinted title band, the
        PIN box, two links under it, OR, the saved addresses or a way to sign
        in, and Continue Shopping — grey until a place is chosen.
      */}
      <DialogContent className="grid-cols-[minmax(0,1fr)] gap-0 p-0 sm:max-w-[30rem]">
        <DialogHeader className="items-center rounded-t-xl border-b border-border bg-muted/60 px-6 py-4 text-center">
          <DialogTitle className="text-lg font-semibold sm:text-xl">Select Delivery Location</DialogTitle>
        </DialogHeader>

        {/*
          min-w-0, and the grid column minmax(0,1fr) above: a long address in an
          answer is one unbreakable line, and a grid item sizes to it — the
          window grew past its own edge and the right of every row was cut off.
        */}
        <div className="min-w-0 space-y-4 px-5 py-5 sm:px-8 sm:py-6">
          <DialogDescription className="text-center text-sm text-foreground/80 sm:text-base">
            Select a delivery location to see product availability
          </DialogDescription>

          <form
            className="relative"
            onSubmit={(event) => {
              event.preventDefault();
              if (isFullPincode(pincode)) void checkPin(pincode);
            }}
          >
            <MapPin className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-foreground/70" aria-hidden />
            <input
              ref={inputRef}
              value={pincode}
              onChange={(event) => {
                // Digits only, six at most — the same reading every zone rule uses.
                const code = normalizePincode(event.target.value);
                checkSeq.current += 1;
                setPincode(code);
                setResult(null);
                suggestFor(code);
                // A whole PIN is checked as soon as it is typed — no button to find.
                if (isFullPincode(code)) void checkPin(code);
              }}
              onFocus={() => {
                if (pincode.length >= 3 && !isFullPincode(pincode)) setListOpen(true);
              }}
              // A choice is made on mousedown, before this — so leaving the box only closes the list.
              onBlur={() => setListOpen(false)}
              onKeyDown={(event) => {
                if (!listOpen || !suggestions.length) return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((i) => Math.min(i + 1, suggestions.length - 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (event.key === "Enter" && active >= 0) {
                  // Inside the form: Enter picks, it does not submit five digits.
                  event.preventDefault();
                  pickSuggestion(suggestions[active].pincode);
                }
                // Escape is the window's to hear: see its onOpenChange.
              }}
              role="combobox"
              aria-expanded={listOpen}
              aria-controls={listId}
              aria-autocomplete="list"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={6}
              aria-label="PIN code"
              placeholder="Enter Pincode"
              className="h-12 w-full rounded-md border border-foreground/30 bg-muted/40 pr-11 pl-11 text-base font-medium tracking-wide outline-none placeholder:tracking-normal placeholder:text-foreground/60 focus:border-bakery-700 focus:bg-card focus:ring-3 focus:ring-ring/40"
            />
            <button
              type="submit"
              aria-label="Check"
              disabled={!isFullPincode(pincode)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1.5 text-foreground/70 hover:text-foreground disabled:opacity-50"
            >
              {result?.kind === "pin" && result.lookup === null ? (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              ) : (
                <Search className="size-5" aria-hidden />
              )}
            </button>
            {listOpen ? (
              <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover text-sm shadow-lg">
                <ul id={listId} role="listbox" aria-label="PIN codes" className="max-h-56 overflow-auto py-1">
                  {suggestions.map((place, i) => (
                    <li
                      key={place.pincode}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        pickSuggestion(place.pincode);
                      }}
                      className={cn("cursor-pointer px-4 py-2", i === active ? "bg-muted" : "hover:bg-muted/60")}
                    >
                      {/* The digits typed in bold, the rest of the PIN plain — "**3240**01, Kota". */}
                      <span className="font-semibold">{pincode}</span>
                      {place.pincode.slice(pincode.length)}
                      {place.districts[0] ? `, ${place.districts[0]}` : ""}
                    </li>
                  ))}
                  {suggestedFor === pincode && suggestions.length === 0 ? (
                    <li className="px-4 py-2 text-muted-foreground">No PIN code starts with {pincode}</li>
                  ) : null}
                </ul>
                <div className="divide-y divide-border border-t border-border bg-muted/40">
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setListOpen(false);
                      setFindingPin(true);
                    }}
                    className="block w-full px-4 py-2 text-left font-medium text-bakery-700 hover:bg-muted/60"
                  >
                    Don&apos;t Know Pincode?
                  </button>
                  {/* Only the first few are listed: all six digits are checked whatever they are. */}
                  <p className="px-4 py-2">
                    <span className="font-medium text-foreground">Don&apos;t see your Pincode?</span>{" "}
                    <span className="text-muted-foreground">Type all 6 digits.</span>
                  </p>
                </div>
              </div>
            ) : null}
          </form>

          <div className="-mt-1 flex items-center justify-between gap-2 text-sm">
            <button
              type="button"
              aria-expanded={findingPin}
              className="font-medium text-bakery-700 hover:underline"
              onClick={() => setFindingPin((now) => !now)}
            >
              Don&apos;t Know Pincode?
            </button>
            <button
              type="button"
              onClick={detect}
              disabled={locating}
              className="inline-flex items-center gap-1.5 font-medium text-bakery-700 hover:underline disabled:opacity-60"
            >
              {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Crosshair className="size-4" aria-hidden />}
              Detect my location
            </button>
          </div>
          {findingPin ? (
            <div className="-mt-1 space-y-1.5 rounded-md bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Type your area or a landmark, and we&apos;ll find its PIN code.</p>
              <PlaceSearch onPick={takeFoundPlace} placeholder="Your area, e.g. Talwandi, Kota" />
            </div>
          ) : null}
          {note ? <p className="-mt-2 text-xs text-destructive">{note}</p> : null}

          {result ? (
            <div className="rounded-lg border border-border bg-card px-3 py-2.5">
              {result.kind === "pin" ? (
                <DeliveryAnswer
                  result={result.lookup}
                  pincode={result.pincode}
                  loading={result.lookup === null}
                  exactCheck={false}
                />
              ) : (
                <SpotAnswerView answer={result.answer} />
              )}
            </div>
          ) : null}

          {showOr ? (
            <div className="flex items-center gap-3" aria-hidden>
              <span className="h-px flex-1 bg-border" />
              <span className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-foreground/70">
                OR
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
          ) : null}

          {signedIn ? (
            saved.length ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Your saved addresses</p>
                <ul className="space-y-1.5">
                  {saved.map((address) => (
                    <li key={address.id}>
                      <button
                        type="button"
                        onClick={() => {
                          // A saved address is checked by its PIN, like a typed one.
                          const code = normalizePincode(address.pincode);
                          setPincode(code);
                          if (isFullPincode(code)) void checkPin(code);
                        }}
                        className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                      >
                        <span className="font-medium">{address.label || "Address"}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[address.addressLine1, address.city, address.pincode].filter(Boolean).join(", ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null
          ) : (
            <p className="text-sm text-foreground/80">
              Login to view saved addresses.{" "}
              <button
                type="button"
                className="font-medium text-bakery-700 hover:underline"
                onClick={() => {
                  onOpenChange(false);
                  openCustomerAuthModal("phone");
                }}
              >
                Login
              </button>
            </p>
          )}

          {/* Grey until a place is chosen, as the reference has it; it still closes the window. */}
          <Button
            type="button"
            variant={chosen ? "bakery" : "secondary"}
            className={cn("h-12 w-full text-base font-semibold", !chosen && "bg-muted-foreground/50 text-white hover:bg-muted-foreground/60")}
            onClick={() => onOpenChange(false)}
          >
            Continue Shopping
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
