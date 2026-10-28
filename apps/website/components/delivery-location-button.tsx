"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, Pencil } from "lucide-react";

import { fetchZones } from "@/features/commerce/lib/commerce-api";
import { loadDeliveryZones } from "@/features/commerce/lib/delivery-zones-repository";
import { isStorefrontSeeded } from "@/lib/storefront-seed-flag";
import {
  DELIVERY_LOCATION_UPDATED_EVENT,
  deliveryLocationLabel,
  readDeliveryLocation,
  type DeliveryLocation,
} from "@/features/commerce/lib/delivery-location";
import type { DeliveryZone } from "@/types/delivery";

/**
 * The window itself, fetched the first time the button is pressed. The header
 * is on every page of the shop and most visitors never open this; its search,
 * dialog and answers have no business in every page's JavaScript.
 */
const DeliveryLocationModal = dynamic(() => import("./delivery-location-modal"), { ssr: false });

/**
 * India's flag, drawn — a flag emoji is two letters on Windows, not a flag.
 * The shop delivers in India only, which is all the "IND" beside it says.
 */
function IndiaFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 20" aria-hidden className={className}>
      <rect width="30" height="20" fill="#fff" />
      <rect width="30" height="6.67" fill="#FF9933" />
      <rect y="13.33" width="30" height="6.67" fill="#138808" />
      <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.6" />
      <circle cx="15" cy="10" r="0.6" fill="#000080" />
    </svg>
  );
}

/**
 * WHERE AM I HAVING THIS SENT — in the header, where the reference puts it.
 *
 * A pill naming the customer's own place ("Deliver to Kota 324005"), or
 * "Choose Delivery Location" until they have one. Pressing it opens Select
 * Delivery Location: an area or a PIN in one box, or the phone's location, or
 * a saved address — see `DeliveryLocationModal`. Every word about coverage,
 * cost or speed comes from the shop's own zones; a shop with none never
 * mounts this at all — see `hasDeliveryZones`.
 */
export function DeliveryLocationButton() {
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState<DeliveryLocation | null>(null);
  const [zones, setZones] = useState<DeliveryZone[] | null>(null);
  // One read even when the button is pressed twice before the first lands.
  const loading = useRef(false);

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
   * The zone list is read when the window OPENS, not on mount: one extra
   * request on every page load, for a control most visitors never touch, is
   * not worth it. In the handler, not an effect keyed on `open` — opening is
   * an event, and an event is where the work belongs.
   */
  const openWindow = () => {
    setOpen(true);
    if (zones !== null || loading.current) return;
    loading.current = true;
    // The zones the page brought with it (StorefrontCacheSeed), or a request.
    const read = isStorefrontSeeded() ? Promise.resolve(loadDeliveryZones()) : fetchZones();
    void read
      .then((rows) => setZones(rows ?? []))
      .catch(() => setZones([]))
      .finally(() => {
        loading.current = false;
      });
  };

  const chosen = deliveryLocationLabel(location);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={openWindow}
        aria-haspopup="dialog"
        aria-expanded={open}
        /*
          A TINTED PILL, laid out as the reference shop's header has it: the flag
          and country, a rule, the pin, the place, a pencil to change it. The
          tint runs between the shop's own lightest steps, so a shop that picks
          other colours gets this in its own. Level with the search box from lg.
        */
        className="group flex max-w-full items-center rounded-full border border-gold-200 bg-gradient-to-r from-gold-50 to-bakery-50 text-left text-sm shadow-sm transition-premium hover:border-gold-300 hover:shadow lg:h-11 lg:max-w-[22rem]"
      >
        <span className="flex shrink-0 items-center gap-1.5 border-r border-gold-200 py-2 pr-2.5 pl-3.5 lg:pr-3 lg:pl-4">
          <IndiaFlag className="h-3.5 w-5 rounded-[2px] shadow-[0_0_0_0.5px_rgb(0_0_0/0.15)]" />
          <span className="text-xs font-semibold text-foreground lg:text-sm">IND</span>
        </span>
        <span className="flex min-w-0 items-center gap-1.5 py-2 pr-3.5 pl-2.5 lg:gap-2 lg:pr-4 lg:pl-3">
          <MapPin className="size-4 shrink-0 fill-bakery-700 text-gold-50 lg:size-5" aria-hidden />
        {/*
          The customer's own place when they chose one ("Kota 324005"), and a
          plain prompt when not. Never the shop's zone name: "Deliver to
          sangod" was the owner's word, and outlived the zone it named.
        */}
          <span className="truncate font-semibold text-foreground">
            {chosen ? `Deliver to ${chosen}` : "Choose Delivery Location"}
          </span>
          <Pencil className="size-3.5 shrink-0 text-foreground/60 transition-colors group-hover:text-foreground" aria-hidden />
        </span>
      </button>

      {/* Mounted fresh on each open, so it reads the session and the book as they are now. */}
      {open && zones !== null ? <DeliveryLocationModal open onOpenChange={setOpen} zones={zones} /> : null}
    </div>
  );
}
