"use client";

import { OptimizedImage } from "@/components/shared/optimized-image";
import Link from "next/link";
import { parseListField, BANNER_STRIP_MAX, renderableRows } from "@/constants/section-list-fields";
import { sectionAlignOf } from "./lib/section-utils";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { type HomepageSectionRendererProps, contentString, SectionShell, ViewAllLink, SectionHeadingRow } from "./section-parts";

// A client component: it turns on its own, on a timer, and pauses under the
// pointer. Only this band ships that code; the rest of the homepage is drawn
// on the server.

/*
  ONE SHAPE, ONE PACE, AND NEITHER IS A SETTING.

  The shop asked for both boxes gone. They were a choice with no good
  answer behind it: the shape only works if the artwork is exported to
  match, so picking one in the builder without re-exporting gives a band of
  background either side of your own banner — and the seconds box invited a
  number (0.5, 60) that reads as a strobe or as a banner nobody sees turn.

  So the band states what it wants instead of asking, and the size is on the
  picture field, where the shop is standing when it matters.
*/
/*
  TWO SHAPES, AND ONLY WHEN THERE IS A SECOND PICTURE TO PUT IN ONE.

  1520/120 is 12.6:1, which on a 390px screen is a band 28px high — nothing
  written into a banner can be read in that. So a phone gets a 3.8:1 box and
  the row carries a picture cut for it, the way the hero already does.

  BUT THE TALL BOX ONLY HELPS IF THAT PICTURE EXISTS. Without one the wide
  banner is shown whole inside it, and `object-contain` does not enlarge
  anything: measured at 390, the box was 326x86 and the picture inside it
  326x26 — the same unreadable 26px with 60px of tint wrapped round it. On a
  tablet it was worse: a 927x244 box holding a picture 244px shorter than
  itself.

  That was a real mistake and it shipped, because the check measured the BOX
  and called it readable. So the shape is now a question about the content:
  a strip with a phone picture gets the tall box, and one without keeps the
  wide ratio at every width and is short on a phone — which is the honest
  state of a band that has one wide picture and nothing else.
*/
/*
  TWO SHAPES, AND THE SHOP PICKS — which is a reversal, and worth saying why.

  This was a setting, and it was removed as a choice with no good answer
  behind it. That was true while there was one band: picking a shape does
  nothing unless the artwork is exported to match, so the box may as well
  state what it wants.

  It stopped being true the moment there were two. The strip under the
  banner grid is a thin ribbon and right that way; the one under trending is
  a 4.6:1 banner, measured off the layout the shop held up — its picture
  spans about 1380 of a 1900px window and stands 297px tall. One ratio
  cannot be both, and neither is wrong.

  `strip` is the default, so the band already on the page keeps the shape it
  has.
*/
const STRIP_SHAPES = {
  strip: {
    wide: "aspect-[1520/120]",
    withPhone: "aspect-[760/200] lg:aspect-[1520/120]",
  },
  banner: {
    wide: "aspect-[1520/330]",
    withPhone: "aspect-[760/400] lg:aspect-[1520/330]",
  },
} as const;

/** How long each banner holds. */
const STRIP_SECONDS = 5;

/** The turn, in ms. One banner leaves, then the next arrives, each taking this. */
const STRIP_FLIP_MS = 360;

export function BannerStripSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const align = sectionAlignOf(c, "left");
  /*
    Capped here as well as in the editor. The editor's limit stops an admin
    adding a fourth; it does nothing about a fourth that is already stored,
    and the page is what the customer sees.
  */
  const banners = renderableRows(parseListField(c, "banners"))
    .filter((banner) => Boolean(banner.image))
    .slice(0, BANNER_STRIP_MAX);

  /*
    Any of them, not all: the box is one shape for the whole strip, and a
    banner that has a phone picture is the one that needs the room.

    THE TALL PHONE BOX ONLY HELPS IF THAT PICTURE EXISTS. Without one the
    wide banner is shown whole inside it and `object-contain` enlarges
    nothing: measured at 390, a 326x86 box held a picture 326x26 — the same
    unreadable 26px with 60px of tint round it. That shipped, because the
    check measured the BOX and called it readable.
  */
  const chosen =
    STRIP_SHAPES[contentString(c, "shape") as keyof typeof STRIP_SHAPES] ??
    STRIP_SHAPES.strip;
  const shape = banners.some((banner) => banner.mobileImage?.trim())
    ? chosen.withPhone
    : chosen.wide;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    /*
      A visitor whose system asks for less movement gets none. Checked here
      rather than in CSS because stopping the fade would still leave the
      picture changing underneath it, which is the part that moves.
    */
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      STRIP_SECONDS * 1000,
    );
    return () => window.clearInterval(id);
  }, [count, paused]);

  /* A banner removed in the builder must not leave the strip on an index
     that no longer exists — the band would go blank with no clue why. */
  const current = count ? index % count : 0;

  if (count === 0) return null;

  /*
    The same header row as every product band: what this is on the left,
    the way in on the right. `SectionHeader` draws nothing when both are
    blank, which is the shipped state — so a strip with no heading is the
    bare band of artwork it has always been.
  */
  const hasHeader =
    Boolean(contentString(c, "overline").trim() ||
      contentString(c, "title").trim() ||
      contentString(c, "subtitle").trim()) ||
    Boolean(contentString(c, "ctaLabel").trim() && contentString(c, "ctaHref").trim());

  return (
    <SectionShell {...props}>
      {hasHeader ? (
        <SectionHeadingRow
          align={align}
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          description={contentString(c, "subtitle")}
          className="mb-6 items-center"
          trailing={
            <ViewAllLink
              href={contentString(c, "ctaHref")}
              label={contentString(c, "ctaLabel")}
              on={props.section.background}
            />
          }
        />
      ) : null}
      {/*
        PAUSES WHEN SOMEBODY IS THERE.

        Not a hover effect — nothing changes on screen. It is the pause a
        thing that moves on its own has to have: a customer reading the
        small print, or tabbing onto a dot, should not have it turn under
        them. `focusWithin` covers the keyboard, where there is no pointer
        to hover with.
      */}
      <div
        className={cn(
          /*
            `perspective` is what makes the turn a FLIP rather than a
            squash: without it a rotated plane is scaled flat, with no
            near edge coming toward the reader.
          */
          "relative overflow-hidden rounded-2xl bg-cream-100 perspective-normal",
          shape,
        )}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        {banners.map((banner, i) => {
          /*
            THE PHONE GETS ITS OWN PICTURE, or the wide one shown WHOLE.

            Measured: the wide strip is 12.6:1, which on a 390px screen is a
            band 28 pixels tall — nothing written into a banner can be read
            in 28px, and no CSS fixes it, because the answer is a
            differently composed picture. The hero already carries one for
            exactly this reason.

            Without one the phone shows the wide banner letterboxed on the
            band's own tint rather than cropped to fill. A banner with its
            offer drawn into one end would lose the offer, and nothing here
            has seen the artwork. Letterboxed looks unfinished, which is the
            honest state for a picture that has not been exported yet.
          */
          const phone = banner.mobileImage?.trim();
          const alt = banner.label ?? "";
          const picture = (
            <>
              <OptimizedImage
                fill
                sizes="100vw"
                src={phone || banner.image || ""}
                alt={alt}
                className={cn(
                  "lg:hidden",
                  phone ? "object-cover" : "object-contain",
                )}
              />
              {/*
                The words are pixels inside the picture, so the alt is the
                only thing a screen reader has. Empty when the shop has not
                written one — an invented description of a picture nobody
                here has seen is worse than silence. It goes on BOTH, and
                only one of the two is ever displayed.
              */}
              <OptimizedImage
                src={banner.image ?? ""}
                alt={alt}
                fill
                sizes="100vw"
                className="hidden lg:block object-cover"
              />
            </>
          );
          /*
            Every banner is in the DOM, stacked, and only the current one is
            face on. A strip that swapped `src` would show the page's
            background between two pictures on every turn, because the next
            one starts loading when it becomes the current one.

            THE TURN IS A FLIP, in two halves rather than all at once.
            Every banner that is not current rests at the SAME angle, -90°,
            hinged on its top edge — so the outgoing one falls away from the
            reader and the incoming one drops in behind it, both travelling
            the same direction, the way a departure board moves.

            THE DELAY IS WHAT MAKES IT READ. Run both at once and the two
            banners cross through each other at 45°, which is a smear.
            Arriving is delayed by exactly as long as leaving takes, so one
            clears the frame before the next starts.

            `ease-in` on the way out and `ease-out` on the way in, so the
            pair is fastest in the middle and settles at both ends rather
            than stopping dead.

            The opacity goes with it because a plane at 90° is a hairline:
            without the fade there is a frame where neither banner has any
            width and the box shows its own fill.
          */
          return (
            <div
              key={`${banner.image}-${i}`}
              aria-hidden={i === current ? undefined : true}
              className={cn(
                "absolute inset-0 origin-top backface-hidden transition-[transform,opacity]",
                i === current
                  ? "[transform:rotateX(0deg)] opacity-100 ease-out"
                  : "pointer-events-none [transform:rotateX(-90deg)] opacity-0 ease-in",
              )}
              style={{
                transitionDuration: `${STRIP_FLIP_MS}ms`,
                transitionDelay: i === current ? `${STRIP_FLIP_MS}ms` : "0ms",
              }}
            >
              {banner.href ? (
                <Link
                  href={banner.href}
                  className="absolute inset-0"
                  tabIndex={i === current ? undefined : -1}
                >
                  {picture}
                </Link>
              ) : (
                picture
              )}
            </div>
          );
        })}

        {/*
          NO DOTS. The shop asked for them off, and at 28px tall on a phone
          they took a third of the band.

          What that costs is worth writing down: something that moves on its
          own has to be stoppable, and the dots were the obvious control.
          The pause is still there and still reachable both ways — a pointer
          over the band stops it, and so does tabbing onto the banner's own
          link, which is inside it. A strip with no link and no dots turns
          with nothing to stop it but the pointer.
        */}
      </div>
    </SectionShell>
  );
}
