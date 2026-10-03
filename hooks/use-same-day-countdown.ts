"use client";

import { useEffect, useState } from "react";

import { shopClockNow, timeLeftToday } from "@/features/orders/lib/delivery-date";
import { getActiveLocale } from "@/features/settings/lib/active-locale";

/**
 * How long is left before same-day orders close — one clock, two surfaces.
 *
 * NULL UNTIL THE BROWSER HAS IT, and that is the whole design. A server-
 * rendered figure would be wrong from the moment it was sent, and the first
 * thing it would be wrong about is whether the deadline has already passed:
 * the server's clock is the HOST's, so a UTC box asked "has 14:00 gone?"
 * answers about 14:00 UTC, which is 19:30 in Kota. It would paint a strip that
 * should not exist, in the HTML, to crawlers and to a reader who never
 * hydrates. So state starts null, both passes render nothing, and the value
 * arrives in an effect.
 *
 * A HOOK RATHER THAN A COMPONENT, because the two surfaces look nothing alike
 * — one line under the Add to Cart button, a band of boxes across the homepage
 * — while everything that is easy to get wrong is in here: the null-first
 * pass, the shop's timezone, the tick, the teardown and the clear.
 */
export function useSameDayCountdown(
  closesAt: string | undefined,
  /**
   * What the server already worked out, so the band is in the HTML.
   *
   * Without it this starts at null on both passes, so the band is absent
   * from the server's render and appears about 900ms later — 292px of it,
   * pushing the homepage down. Measured: CLS 0.152 at 390.
   *
   * It arrives as a PROP, serialized in the payload, which is why seeding
   * state with it cannot cause a hydration mismatch: the server's render
   * and the browser's first render read the same string. The effect below
   * still owns every value after the first.
   */
  initial?: string | null,
): string | null {
  const [timeLeft, setTimeLeft] = useState<string | null>(initial ?? null);

  useEffect(() => {
    const at = (closesAt ?? "").trim();

    /*
      THE SHOP'S CLOCK, NOT THE VISITOR'S — and read inside the tick rather
      than during render. `getActiveLocale` is module state that the root
      layout publishes into the RSC graph and `LocaleSync` publishes into the
      client graph during THEIR render; an effect runs after the tree has
      rendered, so by here it is set. Reading it during render would work
      today and would couple this value to a module read on the SSR pass,
      which is the shape of the currency mismatch active-locale.ts warns
      about.
    */
    const tick = () =>
      setTimeLeft(at ? timeLeftToday(at, shopClockNow(getActiveLocale().timezone)) : null);
    tick();

    /*
      CLEARED THROUGH THE TICK, unlike the effect this replaces. That one
      returned early and left the last value in state, which was safe only
      because its single caller also gated its render on the cutoff too. A
      shop that empties the field mid-session now stops the countdown here,
      so no second caller has to remember to gate twice.

      Through `tick` rather than a `setTimeLeft(null)` of its own, so there is
      ONE expression deciding what the countdown reads rather than two that
      have to agree — and because a bare setState in an effect body is what
      `react-hooks/set-state-in-effect` is for.
    */
    if (!at) return;
    /*
      LEFT RUNNING after the value goes null. It costs one comparison a
      second, and it is what makes a tab left open overnight show tomorrow's
      countdown instead of nothing — and, the other way round, what takes the
      band OFF the page on the tick at the cutoff without a reload.
    */
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [closesAt]);

  return timeLeft;
}
