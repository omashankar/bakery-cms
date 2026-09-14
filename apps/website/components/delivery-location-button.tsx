"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchZones } from "@/features/commerce/lib/commerce-api";
import {
  DELIVERY_LOCATION_UPDATED_EVENT,
  deliveryLocationLabel,
  lookUpDeliveryPincode,
  readDeliveryLocation,
  saveDeliveryLocation,
  type DeliveryLocation,
  type DeliveryLookup,
} from "@/features/commerce/lib/delivery-location";
import { normalizePincode } from "@/features/commerce/lib/delivery-zone-utils";
import { formatCurrency } from "@/utils/format";
import type { DeliveryZone } from "@/types/delivery";
import { cn } from "@/lib/utils";

/**
 * WHERE AM I HAVING THIS SENT — in the header, where the reference puts it.
 *
 * Every word this renders about coverage, speed or cost is read out of the
 * shop's own Delivery Zones. It states nothing of its own: an unmatched pincode
 * says only that no zone covers it, a matched one repeats that zone's name, its
 * own minimum days and its own charge, and a shop with no zones at all never
 * mounts this at all — see `hasDeliveryZones`, which is the difference between
 * "we do not deliver there" and "nobody has said yet".
 */
export function DeliveryLocationButton() {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [entered, setEntered] = useState("");
  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DeliveryLookup | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setLocation(readDeliveryLocation());
    sync();
    window.addEventListener(DELIVERY_LOCATION_UPDATED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DELIVERY_LOCATION_UPDATED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /**
   * The zone list is fetched when the panel OPENS, not on mount.
   *
   * This component sits in the header of every storefront page. Fetching on
   * mount would put one extra request on every page load of every visit, for
   * a control most visitors never touch — the list is only needed the moment
   * somebody actually types a PIN code.
   *
   * In the handler rather than in an effect keyed on `open`, because the
   * effect version sets state synchronously during the effect — a cascading
   * render this repo's lint rules reject, and here an avoidable one: opening
   * the panel is an event, and an event is where the work belongs.
   */
  const openPanel = () => {
    setOpen(true);
    if (zones !== null || loading) return;
    setLoading(true);
    void fetchZones()
      .then((rows) => setZones(rows ?? []))
      // An empty list on failure, not a retry loop: the panel then says it
      // found no covering zone, which is what it knows, instead of claiming
      // the shop does not deliver there, which it does not.
      .catch(() => setZones([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  const check = () => {
    if (zones === null) return;
    const found = lookUpDeliveryPincode(zones, entered);
    setResult(found);
    if (found?.served) {
      const pincode = normalizePincode(entered);
      saveDeliveryLocation({ pincode, label: found.zoneName });
      setLocation({ pincode, label: found.zoneName });
    }
  };

  const chosen = deliveryLocationLabel(location);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
        aria-expanded={open}
        className="flex max-w-[13rem] items-center gap-2 rounded-full border border-input bg-cream-50 px-3 py-2 text-left text-sm transition-premium hover:border-bakery-300"
      >
        <MapPin className="size-4 shrink-0 text-bakery-700" />
        {/*
          The zone's own name when there is one, and a plain prompt when there
          is not. The prompt is interface wording — it names the control, not a
          place the shop delivers to.
        */}
        <span className={cn("truncate", chosen ? "font-medium text-foreground" : "text-muted-foreground")}>
          {chosen ? `Deliver to ${chosen}` : "Delivery location"}
        </span>
        <Pencil className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div className="absolute top-full right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-white p-4 shadow-md">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Check your PIN code</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="-mt-1 -mr-1 rounded-md p-1 text-muted-foreground hover:bg-cream-100 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              check();
            }}
          >
            <Input
              value={entered}
              // The same normalisation every zone rule is matched through, so
              // what the customer sees typed is exactly what gets compared.
              onChange={(event) => setEntered(normalizePincode(event.target.value))}
              inputMode="numeric"
              autoComplete="postal-code"
              aria-label="PIN code"
              placeholder="PIN code"
            />
            <Button type="submit" variant="bakery" disabled={!entered || loading}>
              Check
            </Button>
          </form>

          {loading ? (
            <p className="mt-3 text-sm text-muted-foreground">Checking…</p>
          ) : result === null ? null : result.served ? (
            <div className="mt-3 space-y-1 text-sm">
              {/*
                Three facts, each from the matched zone's own record, and each
                shown only when the zone actually carries it. A zone with no
                name, no days and no charge prints one line saying it is served
                — which is all the shop has said.
              */}
              <p className="font-medium text-foreground">
                {result.zoneName ? `Delivered in ${result.zoneName}` : "We deliver here"}
              </p>
              {result.minDeliveryDays !== null ? (
                <p className="text-muted-foreground">
                  {result.minDeliveryDays <= 0
                    ? "Same-day delivery available"
                    : result.minDeliveryDays === 1
                      ? "From the next day"
                      : `From ${result.minDeliveryDays} days ahead`}
                </p>
              ) : null}
              {result.charge !== null ? (
                <p className="text-muted-foreground">
                  {result.charge > 0
                    ? `Delivery ${formatCurrency(result.charge)}`
                    : "Free delivery"}
                </p>
              ) : null}
            </div>
          ) : (
            /*
              NOT SERVED, said as narrowly as it is known. "No delivery area
              covers this PIN code" is a fact about the shop's own zone list.
              "We do not deliver to you" is a claim about the shop, and a shop
              that takes that order by phone would be calling it a liar.
            */
            <p className="mt-3 text-sm text-muted-foreground">
              No delivery area covers this PIN code yet.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
