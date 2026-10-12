"use client";

import Link from "next/link";
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

    What it does: drops the leading zero units, keeps at most two. Above an
    hour that is hours and minutes; inside the last hour, minutes and seconds,
    which is the only stretch of the day where a second is the difference
    between an order landing today and not; inside the last minute, seconds
    alone. A previous cut of this branched on `parts.hours` only, which read
    "00 MINUTES | 40 SECONDS" for the final minute — the exact dead cell the
    two-unit clock exists to remove.

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

        THREE ACROSS FROM `md`, NOT `sm`, and that is measured rather than
        taste. At a 640px viewport the container is `sm:px-6` and the panel
        another 24 a side, so the row has 544px; the clock takes ~177 and the
        button ~137, with two 32px gaps. That leaves the sentence — the only
        thing here that says WHAT is closing — about 166px at 24px type, which
        is seven characters a line. 640-767 is every small tablet and every
        1280 window at 200% zoom, and stacked is already the correct answer
        one pixel below it. At 768 the same sum gives ~293px, which holds a
        headline over two lines.
      */}
      <div className="relative flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:gap-8">
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
        <div
          className="flex shrink-0 flex-col items-center gap-2"
          aria-hidden="true"
        >
          {/*
            ONE INSTRUMENT, NOT TWO LOOSE NUMBERS.

            The tiles floated with 10px of band between them, so they read as
            separate figures rather than one reading — the reference has the
            same problem and answers it with nothing. A single shell split by a
            hairline says the parts belong together, and it is the STRUCTURE
            saying it rather than a colon, which is punctuation borrowed off a
            stopwatch.

            THE COLUMN COUNT FOLLOWS THE CELLS, because in the last minute
            there is one. `grid-cols-2` with a single child leaves half the
            shell empty and `divide-x` draws on `:not(:last-child)`, so the
            one cell would sit in a lopsided box with no divider in it. Both
            class names are written out rather than built from a template, so
            Tailwind's scanner can see them.

            `inline-grid` + `grid-cols-2` rather than two fixed squares: an
            auto-width inline grid takes the max-content of its widest cell and
            gives both columns that, so the two cells are identical without a
            magic number, and neither can clip its label at a larger base font or
            under browser zoom. That is worth more here than a fixed width: the
            longest label is what sizes a cell, and a shop's own heading font
            decides how long that is.

            MEASURED COST of not fixing it: the shell is 177.2px while the
            labels are HOURS|MINUTES and 186.8px while they are MINUTES|SECONDS,
            because "Seconds" is the wider word. So the clock block moves 6.6px
            once a day, at the one tick where the reading changes anyway — and
            0px on every other tick of the day, which is the number that
            matters and is measured below. `shrink-0` stops the flex row
            squeezing it.

            `bg-primary` + `text-primary-foreground`: appearance-tokens.ts sets
            `--primary` to the shop's own colour and `--primary-foreground` to
            `readableInkOn(primaryColor)`, so the ink is contrast-checked per
            shop rather than chosen once here. Not `bg-bakery-900` (every
            `--bakery-*` step is derived from the same primary, so a pale brand
            gives a pale box and the digits vanish), not `variant="bakery"`'s
            `text-white` (welded, and unreadable on a light primary), and not
            `--cream-50`, which is literally #ffffff and pinned there by decree.

            The divider and the unit labels are that same ink at 25% and 80%,
            for the same reason: a border colour picked here would be a hairline
            on one shop's primary and invisible on another's. Measured on four
            primaries — the shop's #6f4e37, a pale #f4e3c3 where
            `readableInkOn` flips to dark ink, a near-black #14110d and the Ink
            preset's #1f2a44 — the labels come out 5.48, 6.17, 12.11 and 9.62
            to 1, so the weakest of them still clears AA for body text; the
            divider lands 1.60-2.23, which is a separator rather than a seam.
            At 15% the pale case was 1.31 and effectively absent.
          */}
          <div
            className={cn(
              "inline-grid divide-x divide-primary-foreground/25 rounded-xl bg-primary text-primary-foreground",
              cells.length === 1 ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {cells.map(([label, value]) => (
              <span
                key={label}
                className="flex flex-col items-center gap-1 px-4 py-3"
              >
                {/*
                  `tabular-nums` and an equal-column grid are what keep this the
                  one thing on the homepage that does not move: a "1" is
                  narrower than a "0", and without them the cells breathe once a
                  second and the line beside them shuffles. A tick repaints two
                  glyphs and reflows nothing, which is why
                  `prefers-reduced-motion` has nothing here to suppress.

                  `lg:text-3xl` RATHER THAN `sm:`, so the digits step up with
                  the sentence instead of before it. They stepped at `sm` while
                  the headline was still `text-2xl`, which meant that in the
                  tightest three-across range the clock outweighed the only thing
                  on the band that says what is closing. Now they are 24px
                  together and 30px together.

                  AND NO BIGGER. Dropping to two cells left room to grow them and
                  they are not taking it: the sentence is the band, and digits
                  above it in the type scale would turn the shop's own line back
                  into a caption for a timer.
                */}
                <span className="font-heading text-2xl leading-none font-bold tabular-nums lg:text-3xl">
                  {value}
                </span>
                <span className="text-[0.625rem] leading-none font-semibold tracking-[0.12em] uppercase text-primary-foreground/80">
                  {label}
                </span>
              </span>
            ))}
          </div>
          {/*
            WHAT CLOSES, AND WHEN — the half of the fact the page never showed.

            "04 : 55" does not say what runs out or at what time, and the shop's
            headline beside it need not mention either. The sr-only sentence
            above says both. So the SIGHTED reader was the one getting less,
            from a band whose entire case is that the deadline is real and
            checkable.

            NO NEW WORDS, and that is deliberate under a rule that says wording
            is the shop's: "Same-day orders close at" is the label on the
            Settings -> Commerce field this figure is read from, verbatim, and
            the opening of the sr-only sentence. The figure is `cutoff` itself,
            printed as the shop typed it — a 12-hour rendering would be this
            software's second opinion about a time somebody already chose how to
            write.

            Inside the `aria-hidden` block on purpose: the spoken version stays
            ONE sentence instead of being read out, then read out again.

            `text-muted-foreground` is fixed in globals.css rather than written
            by appearance-tokens, and so is every `--band-*` tone, so this
            pairing holds whatever palette a shop picks and in dark mode — where
            `--muted-foreground` is #e4d5c2 on a #383021 sand.
          */}
          <p className="text-[0.6875rem] leading-none font-semibold tracking-[0.04em] text-muted-foreground">
            Same-day orders close at {cutoff}
          </p>
        </div>
        {/*
          THE SENTENCE IS THE BAND, which is what the reference gets right and
          the first cut of this did not: at `text-lg` beside three boxes it
          read as a caption for them. It is the only thing here that says what
          is closing.
        */}
        <p className="min-w-0 font-heading text-xl leading-snug font-bold text-balance sm:text-2xl md:flex-1 lg:text-3xl">
          {headline}
        </p>
{/*
          A BUTTON, NOT THE ROW PILL — and this band is the reason the two
          differ. `ViewAllLink` is quiet on purpose: at the end of a heading
          it labels the row beneath it rather than competing with the cards.
          There are no cards beneath this one. It is a sentence with a
          deadline on it, and the control at the end is the only thing to
          press. On a sand band the pill also comes out
          `bg-band-sand-strong` — sand on sand, which is the low-contrast
          result the reference gets its punch by avoiding.

          `bg-primary` joins the tiles rather than introducing a third
          colour, and `--primary-foreground` is `readableInkOn(primaryColor)`,
          so the ink is contrast-checked per shop instead of chosen here. Not
          `<Button>`: its default variant carries `hover:bg-primary/90`, and
          no hover is a standing rule on this shop.

          NOTHING WITHOUT BOTH HALVES, the same rule `ViewAllLink` keeps: a
          label with no destination is a button that does not work, and a
          destination with no label is a blank box.
        */}
        {contentString(c, "ctaHref") && contentString(c, "ctaLabel") ? (
          <Link
            href={contentString(c, "ctaHref")}
            /*
              `min-h-11` rather than padding alone: measured at 390px the row
              pill came out 31px tall, under every target-size guideline
              there is, and the label here is 13px type so padding could not
              reach it either.
            */
            /*
              AND A FOCUS RING THE KEYBOARD CAN SEE. It is the only focusable
              thing in the band and it had nothing of its own: Tailwind's base
              layer sets `outline-ring/50` on `*` and never sets a width, so a
              keyboard user got whatever the UA chose to draw over a solid
              `bg-primary`.

              `outline-foreground` rather than the `outline-ring`/`ring-ring`
              habit everywhere else in this repo: `--ring` is
              `appearanceCssVariables`' ACCENT, a shop-chosen colour that on
              this shop is #d4a373 — about 1.9:1 on the sand band, i.e. no ring
              at all on exactly the pale palettes that need one. `--foreground`
              is fixed in globals.css (#2d2d2d light, #faf8f4 dark) and so are
              the four `--band-*` tones, so this is a visible 2px on all six
              backgrounds, in both themes, on any palette. `outline` rather than
              `ring`, because `ring` is a box-shadow and would need a matching
              `ring-offset-color` not to sit flush against the button.
            */
            className="flex min-h-11 max-w-full shrink-0 items-center justify-center rounded-lg bg-primary px-6 text-center text-sm font-bold tracking-wider text-primary-foreground uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            {contentString(c, "ctaLabel")}
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
          shows hours and minutes until the last hour, minutes and seconds inside
          it, and seconds alone in the last minute — so the first cell is never a
          “00”.
        </p>
      ) : null}
    </SectionShell>
  );
}
