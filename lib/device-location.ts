import type { LatLng } from "@/types/delivery";

/**
 * WHERE THIS DEVICE IS — as well as it can say in a few seconds.
 *
 * `getCurrentPosition` hands back the FIRST fix, and a phone's first fix is
 * usually its mobile tower or Wi-Fi guess, hundreds of metres out; its GPS
 * settles a few seconds later. So this watches, keeps the best reading, and
 * stops as soon as one is good enough — or a little after the first, or at
 * the deadline (owner, 2026-10-28: "current location bhi shi se nhi
 * dikhata"). A computer has no GPS: it gives one network guess, said as one
 * by its `accuracy`, which callers draw.
 *
 * Every "use my location" button in the shop asks through here: checkout's
 * map, the header's "Detect my location", the product page's address check,
 * and the zone editor's "I am at the shop".
 */

export interface DeviceFix {
  point: LatLng;
  /** How far off the device says it may be, in metres. */
  accuracy: number;
}

/** A reading this close is the door, not a guess at it. */
const GOOD_ENOUGH_METRES = 30;
/** After the first reading, how long a better one is waited for. */
const SETTLE_MS = 3_000;
/** The whole wait, whatever the device does. */
const DEADLINE_MS = 10_000;

export function locateDevice(): Promise<DeviceFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("This browser can't share its location. Search your area instead."));
      return;
    }
    let best: DeviceFix | null = null;
    let done = false;
    let watch = 0;
    let settle = 0;

    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watch);
      window.clearTimeout(settle);
      window.clearTimeout(deadline);
      if (best) resolve(best);
      else reject(error ?? new Error("We couldn't get your location. Search your area instead."));
    };
    const deadline = window.setTimeout(() => finish(), DEADLINE_MS);

    watch = navigator.geolocation.watchPosition(
      (position) => {
        const fix = {
          point: { lat: position.coords.latitude, lng: position.coords.longitude },
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : Number.POSITIVE_INFINITY,
        };
        const first = best === null;
        if (!best || fix.accuracy < best.accuracy) best = fix;
        if (best.accuracy <= GOOD_ENOUGH_METRES) finish();
        else if (first) settle = window.setTimeout(() => finish(), SETTLE_MS);
      },
      (error) => {
        // A reading already in hand still answers; a refusal is said plainly, with the way out.
        finish(
          new Error(
            error.code === error.PERMISSION_DENIED
              ? "Location is blocked for this site. Allow it from the lock icon in the address bar, or search your area instead."
              : "We couldn't get your location. Search your area instead.",
          ),
        );
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: DEADLINE_MS },
    );
  });
}
