"use client";

import { ArrowRight, Truck } from "lucide-react";
import Link from "next/link";
import { countdownCells, countdownParts } from "@/features/orders/lib/delivery-date";
import { useSameDayCountdown } from "@/hooks/use-same-day-countdown";
import { type HomepageSectionRendererProps, contentString, SectionShell } from "./section-parts";

// A client component: the countdown ticks every second.

/**
 * HOW LONG IS LEFT TO ORDER FOR TODAY — or nothing at all.
 *
 * Three boxes of digits, the shop's own line, its own way in. The shape came
 * from a layout the shop held up; the deadline comes from the shop. A
 * countdown is the most persuasive thing that can go on a page and the
 * cheapest to fake, so every digit here is derived from
 * `commerce.sameDayCutoff` — the field `isPastSameDayCutoff` already refuses
 * an order against.
 *
 * SEVEN WAYS IT DRAWS NOTHING, each a state a real shop is in:
 *
 *   - `trust` is undefined: there are no server props at all, which is the
 *     builder preview between mount and its fetch landing;
 *   - `trust` is null: the settings read failed;
 *   - the shop named no cutoff, which is the shipped default and therefore
 *     every fresh install;
 *   - the stored string is not a time;
 *   - the shop's lead time is above 0 days, so there is no same-day window to
 *     close — decided on the server by `sameDayCutoffFor`, which sends "", so
 *     the browser never learns the lead time and cannot re-derive this wrong;
 *   - today's cutoff has gone. `timeLeftToday` answers null for that on its
 *     own and it is asked again every second, so the band removes ITSELF at
 *     the cutoff rather than standing there telling somebody to hurry for a
 *     delivery they can no longer have;
 *   - the shop has not written the line beside the clock.
 *
 * On the live page every one of those is the same `null`, returned BEFORE
 * `SectionShell` is constructed — so there is no padded empty stripe and no
 * gap, just one band fewer on a page whose rhythm is padding. In the builder
 * each says which one it is, because a shop that adds this band and sees an
 * empty screen cannot tell "waiting" from "broken" — the bargain
 * `RecentlyViewedSection` already strikes.
 */
export function SameDayCountdownSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  /*
    FROM THE SERVER, AND FROM NOWHERE ELSE.

    Not `getCommerceSettings()`, which is the browser's settings cache and
    falls back to the SHIPPED defaults — and the shipped `sameDayCutoff` is
    "", so that would read as "no countdown" on a shop that has one and would
    ignore `deliveryLeadDays` entirely. `sameDayCutoffFor` on the server has
    already refused to hand over a cutoff for a shop that cannot deliver
    today.

    `?? ""` on a field the type says is always there, deliberately: `trust`
    crosses a JSON boundary to reach the builder preview, and
    `undefined.trim()` is a blank admin screen rather than a missing band.
  */
  const cutoff = (props.trust?.sameDayCutoff ?? "").trim();
  const headline = contentString(c, "headline").trim();

  /*
    CALLED BEFORE ANY EARLY RETURN, and called HERE rather than in
    `HomepageSectionRenderer`. In the switch, every one of the nine bands on
    the page mounts its own copy of that component, so the hook would tick and
    re-render all nine once a second. After a `return null` it would be a
    conditional hook, which is a different bug from the one being avoided.
  */
  const parts = countdownParts(
    useSameDayCountdown(cutoff, props.trust?.sameDayTimeLeft),
  );

  if (!parts || !headline) {
    if (!props.interactive) return null;
    /*
      THE BUILDER IS TOLD WHICH ONE IT IS, ordered by how hard each is to find
      from here: the settings screen is a different page, the headline box is
      six inches to the left.
    */
    return (
      <SectionShell {...props}>
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm leading-relaxed text-muted-foreground">
          {props.trust === undefined
            ? "Reading this shop’s settings…"
            : props.trust === null
              ? "This shop’s settings could not be read, so there is no deadline behind this band. It draws nothing on the live page rather than a made-up one."
              : !cutoff
                ? "Set Settings → Commerce → “Same-day orders close at”, and keep the delivery lead time at 0 days. Without both there is no same-day window, so this band draws nothing at all on the live page."
                : !headline
                  ? "Write the line that sits beside the clock, in the box on the left. Boxes of digits with nothing saying what is closing is not something to publish, so the band stays hidden until it is written."
                  : `Same-day orders closed at ${cutoff}, so this band is drawing nothing until midnight. Nothing is broken and nothing is hidden: a countdown that has run out would be telling somebody to hurry for a delivery they can no longer have.`}
        </p>
      </SectionShell>
    );
  }

  /*
    WHICH UNITS ARE SHOWN IS ITSELF PART OF THE FACT — and the rule that
    decides is in `delivery-date.ts`, beside the arithmetic it reads.

    Not here, and that is the point: a branch written inline can only be
    guarded by scanning this file for the shape of its own source, which is a
    test that passes for the very regression it names. `countdownCells` is
    pure, takes the three strings and returns the cells, so the rule can be
    asserted at 00:00:09 and mutated red without a browser.

    What it does: drops the leading zero units and keeps the rest, seconds
    included all day (the shop asked to see the clock run). Above an hour that
    is hours, minutes and seconds; inside the last hour, minutes and seconds;
    inside the last minute, seconds alone — never a leading "00".

    NOT A COUNT THAT GROWS OR REDDENS as the time goes. It changes RESOLUTION
    rather than volume: the same colour, the same weight, different units. A
    band that gets louder as it empties is a pressure tactic wearing a fact's
    clothes, and this shop has had that scrubbed off its pages twice.

    NOTE WHAT THIS IS NOT: it does not make the digits and `parts.spoken`
    agree. `spoken` never says seconds at all — "12 minutes left" while the
    cells read MINUTES | SECONDS — and that is deliberate on its side, because
    a sentence that is only announced once has to stay true for longer than a
    tick. Two renderings of one fact at two resolutions, not a mismatch.
  */
  const cells = countdownCells(parts);

  return (
    <SectionShell
      {...props}
      /*
        A PASTEL WASH ACROSS THE STRIP, the shop's reference (2026-10-13):
        sand, mint and sky running into each other.

        Every stop is one of the shop's own `--band-*-strong` tokens — the
        same pastels its section backgrounds use, with dark-mode values in
        globals.css — mixed TOWARDS TRANSPARENT, so the tone the Background
        dropdown picks still shows through underneath rather than being
        painted over. `background-image` sits over the tone's
        `background-color`; it does not replace it.

        A ring rather than a border: `ring` draws inside the rounded corner,
        so it cannot leave the 1px notch a `border` leaves on a `rounded-2xl`
        box at some zoom levels.
      */
      panelClassName="bg-[linear-gradient(100deg,color-mix(in_oklab,var(--band-sand-strong)_70%,transparent)_0%,color-mix(in_oklab,var(--band-mint-strong)_70%,transparent)_30%,color-mix(in_oklab,var(--band-sky-strong)_75%,transparent)_55%,color-mix(in_oklab,var(--band-mint-strong)_70%,transparent)_80%,color-mix(in_oklab,var(--band-sand-strong)_70%,transparent)_100%)] px-4 py-5 ring-1 ring-border sm:px-6 lg:px-14"
    >
      {/*
        NO `bg-*` HERE, and that is the point: SectionShell applies the
        Background setting BEFORE this className, so a colour passed here
        outranks it and the dropdown goes inert.

        `relative` is load-bearing rather than styling: Tailwind's `sr-only`
        is `position: absolute`, and with no positioned ancestor it escapes
        every `overflow: hidden` on the way up.

        CLOCK | SENTENCE | BUTTON, as the reference lays it out: the clock at
        the start, the sentence centred in what is left, the button at the
        end — from `md`. Stacked and centred on a phone.
      */}
      <div className="relative grid items-center justify-items-center gap-4 text-center md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-8">
        {/*
          THE FACT, ONCE, AND NOT TICKING.

          A region that changes every second is either announced every second
          — 3,600 interruptions an hour, which makes the rest of the page
          unreachable — or never. So the digits are hidden and one sentence
          stands for them. It leads with the TIME, which never changes, and
          `spoken` drops the seconds so even that half stays true for a
          minute. No `aria-live` anywhere, and no `role="timer"`: both leave a
          live region in the markup for a later edit to switch on.

          The cutoff is read out as the shop typed it. A 12-hour rendering
          would be this software's second opinion about a time somebody
          already chose how to write.
        */}
        <p className="sr-only">
          Same-day orders close at {cutoff} today — {parts.spoken}.
        </p>

        {/*
          A DARK TILE PER UNIT, its name spelled out underneath — the
          reference's clock.

          `bg-foreground` + `text-background`: both fixed in globals.css, not
          written by the shop's palette, so the digits keep their contrast
          whatever brand colour the shop picks — and in dark mode the pair
          inverts, which is still a strong tile on a dark page.

          `tabular-nums` and a fixed tile width keep the clock still as its
          digits change, so the sentence beside it never shuffles; a tick
          repaints glyphs and reflows nothing.

          NOT A COUNT THAT GROWS OR REDDENS as the time goes: the same colour
          and weight at 5 hours and at 5 seconds. A band that gets louder as it
          empties is a pressure tactic wearing a fact's clothes.
        */}
        <div aria-hidden="true" className="flex items-start gap-3 sm:gap-4">
          {cells.map(([label, value]) => (
            <span key={label} className="flex flex-col items-center gap-2">
              <span className="flex h-14 w-16 items-center justify-center rounded-lg bg-foreground font-heading text-3xl leading-none font-medium text-background tabular-nums shadow-sm lg:h-16 lg:w-[4.5rem] lg:text-4xl">
                {value}
              </span>
              <span className="text-[0.625rem] leading-none font-semibold tracking-[0.25em] text-foreground uppercase">
                {label}
              </span>
            </span>
          ))}
        </div>

        <div className="min-w-0">
          {/*
            THE SENTENCE IS THE BAND: the only thing in it that says what is
            closing, in the shop's own words, and the largest type on it.
          */}
          <p className="font-heading text-2xl leading-tight font-bold text-balance sm:text-3xl md:text-2xl lg:text-3xl xl:text-4xl">
            {headline}
          </p>
          {/*
            WHEN IT CLOSES, which the clock alone does not say: "Same-day
            orders close at" is the Settings -> Commerce label the figure is
            read from, and the figure is `cutoff` as the shop typed it. Hidden
            from the screen reader, which has it in the one sentence above.
          */}
          <p
            aria-hidden="true"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Truck className="size-3.5" />
            Same-day orders close at {cutoff}
          </p>
        </div>

        {/*
          A BUTTON, NOT THE ROW PILL: there are no cards beneath this band, so
          the control at the end is the only thing to press. Not `<Button>`:
          its default variant carries `hover:bg-primary/90`, and no hover is a
          standing rule on this shop. `bg-primary` with
          `text-primary-foreground`, which is `readableInkOn(primaryColor)` —
          contrast-checked per shop.

          `min-h-12`: past the 44px touch target. `outline-foreground` for the
          focus ring because `--ring` is the shop's accent, about 1.9:1 on a
          pale band.

          NOTHING WITHOUT BOTH HALVES: a label with no destination is a button
          that does not work, and a destination with no label is a blank box.
        */}
        {contentString(c, "ctaHref") && contentString(c, "ctaLabel") ? (
          <Link
            href={contentString(c, "ctaHref")}
            className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-7 text-base font-bold tracking-wide text-primary-foreground uppercase shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            {contentString(c, "ctaLabel")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </div>

      {/*
        SAYS SO WHILE IT IS WORKING, not only once it has gone. An admin who
        opens the builder in the morning would otherwise never learn that this
        band leaves the page at lunchtime. Reads the real cutoff, so it cannot
        drift from the setting, and only the builder ever renders it.
      */}
      {props.interactive ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Only you can see this line. Same-day orders close at {cutoff}, so this
          band draws nothing on the live page from then until midnight. The clock
          drops the hours in the last hour and the minutes in the last minute — so
          the first tile is never a “00”.
        </p>
      ) : null}
    </SectionShell>
  );
}
