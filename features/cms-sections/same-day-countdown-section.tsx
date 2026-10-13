"use client";

import { ArrowRight, Clock, Truck } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { countdownCells, countdownParts } from "@/features/orders/lib/delivery-date";
import { cn } from "@/lib/utils";
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
        A WASH OVER THE TONE, not instead of it.

        One flat fill is what the first cut of this looked like beside the
        reference: a rectangle of paint. The reference is lighter where the
        clock sits and deeper at the far end, and that GRADIENT is the part
        worth taking — its greens and blues are not.

        Every stop is either `transparent` or one of the shop's own tokens,
        and `background-image` sits over the tone's `background-color`
        rather than replacing it. So whichever of the six backgrounds the
        shop picks in the dropdown is still the colour underneath, and this
        only shapes the light on it. `--background` is the shop's palest
        surface and `--primary` its brand colour; at 8% the second is a
        suggestion of weight at the end of the strip, not a second fill.

        Angled from the top-left because that is where the eye starts and
        where the digits are. A ring rather than a border: `ring` draws
        inside the rounded corner, so it cannot leave the 1px notch a
        `border` leaves on a `rounded-2xl` box at some zoom levels.
      */
      panelClassName="bg-[radial-gradient(120%_150%_at_6%_-10%,var(--background)_0%,transparent_66%),linear-gradient(105deg,transparent_30%,color-mix(in_oklab,var(--primary)_13%,transparent)_100%)] ring-1 ring-border"
    >
      {/*
        NO `bg-*` HERE, and that is the point: SectionShell applies the
        Background setting BEFORE this className, so a colour passed here
        outranks it and the dropdown goes inert — three sections in this file
        did exactly that, and one showed "White" in the builder while
        rendering cream.

        `relative` is load-bearing rather than styling: Tailwind's `sr-only`
        is `position: absolute`, and with no positioned ancestor it lays out
        at its static position in the initial containing block and escapes
        every `overflow: hidden` on the way up.

        CLOCK | WORDS | BUTTON from `md`, stacked and centred below it. The
        middle column takes what is left (`minmax(0,1fr)`), so the sentence —
        the only thing here that says WHAT is closing — is the part that
        wraps, never the clock or the button.
      */}
      <div className="relative grid items-center justify-items-center gap-5 text-center md:grid-cols-[auto_minmax(0,1fr)_auto] md:justify-items-start md:gap-8 md:text-left">
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
          A TILE PER UNIT, the way a countdown is drawn, with a colon between —
          the shop asked for the clock to be seen running, seconds included.

          `tabular-nums` and a minimum width on every tile are what keep this
          the one thing on the homepage that does not move: a "1" is narrower
          than a "0", and without them the tiles breathe once a second and the
          sentence beside them shuffles. A tick repaints glyphs and reflows
          nothing, which is why `prefers-reduced-motion` has nothing here to
          suppress. The minimum is sized for the widest label, SECONDS.

          NOT A COUNT THAT GROWS OR REDDENS as the time goes: the same colour
          and weight at 5 hours and at 5 seconds. A band that gets louder as it
          empties is a pressure tactic wearing a fact's clothes.

          `bg-primary` + `text-primary-foreground`: appearance-tokens.ts sets
          `--primary` to the shop's own colour and `--primary-foreground` to
          `readableInkOn(primaryColor)`, so the ink is contrast-checked per shop
          rather than chosen here; the labels are that ink at 80%, which held
          AA on all four primaries it was measured on (5.48–12.11:1).

          The column count is written out per case so Tailwind can see each
          class: in the last hour there are two tiles, in the last minute one.
        */}
        <div
          aria-hidden="true"
          className={cn(
            "inline-grid items-center gap-1.5",
            cells.length === 1
              ? "grid-cols-1"
              : cells.length === 2
                ? "grid-cols-[auto_auto_auto]"
                : "grid-cols-[auto_auto_auto_auto_auto]",
          )}
        >
          {cells.map(([label, value], index) => (
            <Fragment key={label}>
              {index > 0 ? (
                <span className="font-heading text-2xl leading-none font-bold text-primary lg:text-3xl">
                  :
                </span>
              ) : null}
              <span className="flex min-w-[4.5rem] flex-col items-center gap-1.5 rounded-xl bg-primary px-2 py-3 text-primary-foreground shadow-sm">
                <span className="font-heading text-3xl leading-none font-bold tabular-nums lg:text-4xl">
                  {value}
                </span>
                <span className="text-[0.625rem] leading-none font-semibold tracking-[0.12em] uppercase text-primary-foreground/80">
                  {label}
                </span>
              </span>
            </Fragment>
          ))}
        </div>

        <div className="min-w-0">
          {/*
            WHAT KIND OF DEADLINE THIS IS, as a label over the sentence. True
            whenever the band is drawn at all: it renders only while the shop
            has a same-day window open.
          */}
          <p
            aria-hidden="true"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[0.6875rem] font-semibold tracking-[0.08em] text-foreground uppercase"
          >
            <Truck className="size-3.5 text-primary" />
            Same-day delivery
          </p>
          {/*
            THE SENTENCE IS THE BAND. It is the only thing here that says what
            is closing, so it is the largest type in it.
          */}
          <p className="mt-2 font-heading text-xl leading-snug font-bold text-balance sm:text-2xl lg:text-3xl">
            {headline}
          </p>
          {/*
            WHAT CLOSES, AND WHEN, in the label's own words: "Same-day orders
            close at" is the Settings -> Commerce field this figure is read
            from, and the figure is `cutoff` as the shop typed it. Hidden from
            the screen reader, which already has both in the one sentence above.

            `text-muted-foreground` is fixed in globals.css rather than written
            by appearance-tokens, so this pairing holds whatever palette a shop
            picks, and in dark mode.
          */}
          <p
            aria-hidden="true"
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Clock className="size-4 shrink-0" />
            Same-day orders close at{" "}
            <span className="font-semibold text-foreground">{cutoff}</span>
          </p>
        </div>
        {/*
          A BUTTON, NOT THE ROW PILL. `ViewAllLink` is quiet on purpose: at the
          end of a heading it labels the row beneath it. There are no cards
          beneath this one; the control at the end is the only thing to press.

          `bg-primary` joins the tiles rather than introducing a third colour,
          and `--primary-foreground` is contrast-checked per shop. Not
          `<Button>`: its default variant carries `hover:bg-primary/90`, and no
          hover is a standing rule on this shop.

          NOTHING WITHOUT BOTH HALVES: a label with no destination is a button
          that does not work, and a destination with no label is a blank box.
        */}
        {contentString(c, "ctaHref") && contentString(c, "ctaLabel") ? (
          <Link
            href={contentString(c, "ctaHref")}
            /*
              `min-h-11`: 44px, the touch-target size, which padding alone did
              not reach at 13px type.

              `outline-foreground` for the focus ring rather than `--ring`,
              which is the shop's ACCENT and about 1.9:1 on the sand band — no
              ring at all on exactly the pale palettes that need one.
              `--foreground` is fixed in globals.css, so this is a visible 2px
              on every background, in both themes.
            */
            className="flex min-h-11 max-w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-center text-sm font-bold tracking-wider text-primary-foreground uppercase shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
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
