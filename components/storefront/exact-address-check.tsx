"use client";

import { useState } from "react";
import { Check, Crosshair, Loader2, X } from "lucide-react";

import { PlaceSearch, type PlaceSuggestion } from "@/components/shared/place-search";
import { placeLabel, saveDeliveryLocation, soonestDeliveryDays, soonestDeliveryText } from "@/features/commerce/lib/delivery-location";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";
import type { LatLng } from "@/types/delivery";

/**
 * "WILL YOU DELIVER TO MY DOOR?" — answered before checkout, not at it.
 *
 * A shop that delivers by areas drawn on the map cannot answer from a PIN: a
 * PIN covers villages miles apart. Without this the customer learned whether
 * they were served only on checkout's map, after choosing a cake, a message
 * and a slot. Here they search their area, or use their phone's location, and
 * the shop's own server answers — the same check checkout makes — with the
 * charge and how soon.
 *
 * The spot is remembered, so checkout's map opens with the pin on it. No map
 * is drawn here: search and the phone's location are enough to answer, and a
 * product page must stay light.
 */

export type SpotAnswer =
  | { status: "checking" }
  | { status: "yes"; charge: number | null; minDeliveryDays: number | null; freeOver: number | null; where: string }
  | { status: "no"; message: string; where: string; kmToArea?: number };

export interface SpotReply {
  status: string;
  charge?: number;
  minDeliveryDays?: number | null;
  freeDeliveryThreshold?: number;
  formattedAddress?: string;
  /** "Borkhera, Kota" — the pin as a customer names it. */
  placeName?: string;
  /** India Post's PIN at the spot, from its nearest post offices. */
  postalCode?: string | null;
  message?: string;
  /** Refused: where the spot is (India Post's area for it) and how far the nearest area is. */
  found?: { formattedAddress?: string };
  kmToArea?: number;
}

/**
 * The shop's answer for one spot, remembering nothing — null when it could not
 * be asked. No PIN is sent: this asks about the SPOT.
 */
export async function askAboutSpot(location: LatLng): Promise<SpotReply | null> {
  try {
    const res = await fetch("/api/checkout/delivery-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location }),
    });
    const body = (await res.json().catch(() => null)) as { data?: SpotReply } | null;
    return res.ok && body?.data ? body.data : null;
  } catch {
    return null;
  }
}

/**
 * Asks the shop whether it delivers to one spot, and remembers the spot when
 * it does. Checkout compares the spot with the typed address later.
 */
export async function checkDeliverySpot(location: LatLng, where: string, pincode = "", name = ""): Promise<SpotAnswer> {
  try {
    const data = await askAboutSpot(location);
    if (!data) return { status: "no", message: "We couldn't check this location right now. Please try again.", where };
    if (data.status !== "eligible") {
      // Where the spot is, not "Your current location": a computer's guess can be a town away.
      return {
        status: "no",
        message: data.message ?? "Sorry, we don't deliver here yet.",
        where: data.found?.formattedAddress ? `Near ${data.found.formattedAddress}` : where,
        ...(typeof data.kmToArea === "number" ? { kmToArea: data.kmToArea } : {}),
      };
    }
    const found = data.formattedAddress || where;
    // Remembered for the header, the other product pages and checkout's map.
    // "Borkhera, Kota" on the header — the map's name for the spot, not the
    // first word of a search result ("PHC" is a health centre, not a place).
    // The spot's own PIN when none was typed, so the product pages answer for it too.
    const pin = pincode || data.postalCode || "";
    // "Borkhera, Kota" says where; a bare town says less than "324002, Kota" does.
    const town = data.placeName && !data.placeName.includes(",") ? data.placeName : "";
    const label = name || (town && pin ? `${pin}, ${town}` : data.placeName || placeLabel(found));
    saveDeliveryLocation({ pincode: pin, label, location });
    return {
      status: "yes",
      charge: typeof data.charge === "number" ? data.charge : null,
      minDeliveryDays: typeof data.minDeliveryDays === "number" ? data.minDeliveryDays : null,
      freeOver: typeof data.freeDeliveryThreshold === "number" ? data.freeDeliveryThreshold : null,
      where: found,
    };
  } catch {
    return { status: "no", message: "We couldn't reach the shop to check this location. Check your connection.", where };
  }
}

/** "Borkhera, Kota" — a found place named by its neighbourhood and town, or "" when it has neither. */
export function shortName(place: Pick<PlaceSuggestion, "area" | "city">): string {
  return [place.area, place.city].filter((part, i, all): part is string => Boolean(part) && all.indexOf(part) === i).join(", ");
}

/** The phone's own position, or a sentence saying why not. */
export function currentPosition(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("This browser can't share its location. Search your area instead."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => reject(new Error("We couldn't get your location. Search your area instead.")),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}

/** What the shop said about a spot. */
export function SpotAnswerView({ answer, className }: { answer: SpotAnswer; className?: string }) {
  return (
    <div aria-live="polite" className={cn("text-sm", className)}>
      {answer.status === "checking" ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Checking…
        </p>
      ) : answer.status === "yes" ? (
        <div className="flex items-start gap-2">
          <Check className="mt-0.5 size-4 shrink-0 text-green-700" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium text-foreground">Yes, we deliver here</p>
            <p className="text-muted-foreground">
              {[
                answer.charge === null ? null : answer.charge > 0 ? `Delivery ${formatCurrency(answer.charge)}` : "Free delivery",
                answer.charge && answer.freeOver ? `free over ${formatCurrency(answer.freeOver)}` : null,
                soonestDeliveryText(soonestDeliveryDays(answer.minDeliveryDays)),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <p className="truncate text-xs text-muted-foreground">{answer.where}</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <X className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div className="min-w-0">
            <p className="font-medium text-foreground">{answer.message}</p>
            <p className="truncate text-xs text-muted-foreground">{answer.where}</p>
            {typeof answer.kmToArea === "number" ? (
              <p className="text-xs text-muted-foreground">
                About {answer.kmToArea < 1 ? "1" : Math.round(answer.kmToArea)} km from where we deliver.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export function ExactAddressCheck({ pincode, className }: { pincode?: string; className?: string }) {
  const [answer, setAnswer] = useState<SpotAnswer | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  async function ask(location: LatLng, where: string, name = "") {
    setAnswer({ status: "checking" });
    setAnswer(await checkDeliverySpot(location, where, pincode ?? "", name));
  }

  function locateMe() {
    setLocating(true);
    setLocateError("");
    void currentPosition()
      .then((point) => ask(point, "Your current location"))
      .catch((error: Error) => setLocateError(error.message))
      .finally(() => setLocating(false));
  }

  return (
    <div className={cn("space-y-2 rounded-lg border border-border bg-card p-3", className)}>
      <p className="text-sm font-medium text-foreground">Check your exact address</p>
      <PlaceSearch
        onPick={(place: PlaceSuggestion) => void ask(place.location, place.label, shortName(place))}
        placeholder="Search your area, street or landmark"
      />
      <button
        type="button"
        onClick={locateMe}
        disabled={locating}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-bakery-700 underline-offset-2 hover:underline disabled:opacity-60"
      >
        {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Crosshair className="size-4" aria-hidden />}
        Use my current location
      </button>
      {locateError ? <p className="text-xs text-destructive">{locateError}</p> : null}
      {answer ? <SpotAnswerView answer={answer} /> : null}
    </div>
  );
}
