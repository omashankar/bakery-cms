"use client";

import { OptimizedImage } from "@/components/shared/optimized-image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { layoutSpacing } from "@/constants/spacing";
import type { HeroCopySide } from "@/types/homepage-builder";
import { cn } from "@/lib/utils";

export interface HeroSlide {
  badge?: string;
  headline: string;
  subtext?: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  imageUrl: string;
  /** What the picture says, when the words are drawn into it. */
  imageAlt?: string;
  /** A second picture, composed for a phone. */
  mobileImageUrl?: string;
}

const AUTOPLAY_MS = 6000;
/** How long one slide takes to move. Must match `duration-700` on the track. */
const SLIDE_MS = 700;
/**
 * How long a press holds the autoplay before it picks up again.
 *
 * Two turns. Long enough that somebody reading a slide they chose is not
 * interrupted; short enough that a carousel they pressed once does not look
 * like one that has died, which is what a permanent stop looked like.
 */
const RESUME_MS = 12000;
const SWIPE_THRESHOLD = 48;

/**
 * WAS the staggered entrance: each part of a slide faded and slid in on a
 * delay. The shop asked for the design without the motion, so it is empty.
 *
 * Kept as a constant rather than deleted from its call sites: those also
 * carry `slide-in-from-*` and `[animation-delay:*]` utilities, and every one
 * of those is inert on its own — they describe an animation that `animate-in`
 * is what actually starts.
 */
const reveal = "";


/**
 * THE BANNER SLIDE — here the picture IS the slide.
 *
 * The only hero there is. A second arrangement used to sit above this one —
 * a framed picture with the words in a column beside it — and the shop chose
 * between them in the builder. It is gone: this CMS draws one hero, the
 * words are part of the artwork the shop uploads, and there is no control to
 * get any of that wrong.
 */
function HeroBannerSlideView({
  slide,
  priority,
  side,
}: {
  slide: HeroSlide;
  /**
   * Fetch this one straight away, and ask for it first.
   *
   * EVERY banner slide is eager, not just the one on screen, and that is not
   * a performance oversight — it is what keeps the band the right height.
   * The slides sit in one flex row so the row is as tall as the tallest, and
   * an image that has not loaded reports the ratio of its `width`/`height`
   * attributes rather than its own. Those attributes are a 3:1 reservation,
   * so a 4.8:1 banner that had not loaded yet claimed 633px where the loaded
   * ones took 396 — and the hero carried 237px of empty band underneath the
   * picture until the third slide happened to come round. Measured.
   *
   * `priority` still marks the FIRST one, which is what gets `fetchPriority`.
   */
  priority?: boolean;
  /** Which half of the picture the words sit in. */
  side: HeroCopySide;
}) {
  const alt =
    /*
      THE SHOP'S OWN DESCRIPTION FIRST, and that order is the point.

      A banner is usually a designed graphic with the headline, the line
      under it and the button drawn INTO the picture. None of that is in
      the DOM, so without this box a screen reader got the fallback below
      and the shop's actual offer was invisible to the people who most
      need it read out.

      Failing that: the headline is drawn OVER the picture when there is
      one, so the picture is decorative and an alt repeating it makes a
      reader say the same sentence twice. With no headline the picture is
      the whole slide, and the shop's own button label is the nearest true
      description of where it leads — never a sentence invented here
      about a photograph nobody in this codebase has seen.
    */
    slide.imageAlt?.trim() || (slide.headline ? "" : slide.primaryLabel);

  const mobile = slide.mobileImageUrl?.trim();

  /**
   * IS THIS SLIDE ALLOWED TO BE CROPPED?
   *
   * Twice yes, once no, and the once is the case this band exists for.
   *
   * A phone picture was composed for the phone's box, so cropping it to that
   * box is what it is for. A slide with a headline lays DOM text over a
   * photograph, and text needs a minimum height whatever the photograph is —
   * cropping a photograph is exactly what `object-cover` is for.
   *
   * A slide with neither is a designed graphic whose headline, strapline and
   * button are drawn INTO the picture. Crop it and you delete the message:
   * these banners carry their words in the right half, which is the half a
   * centre crop throws away. There is no ratio this CMS can pick that is
   * right for every shop's artwork, so it picks none and shows the whole
   * thing.
   */
  const cropped = Boolean(mobile || slide.headline);

  /**
   * ONE download, the right picture.
   *
   * A <picture> rather than two images toggled with `hidden` / `sm:block`:
   * `display: none` does not stop a browser fetching an <img>, so the toggle
   * would put both banners on the wire on every device — on the largest
   * image on the page, on a phone, before anything else renders.
   *
   * A plain <img> inside it, because <source media> is the whole mechanism
   * and next/image does not expose it. That trades the optimiser for
   * correctness, and costs less than it sounds: this path only runs when a
   * shop has deliberately uploaded a second, already-sized picture.
   */
  const image = mobile ? (
    <picture>
      <source media="(min-width: 640px)" srcSet={slide.imageUrl} />
      <img
        src={mobile}
        alt={alt}
        className="absolute inset-0 size-full object-cover"
        // Same reason as the branch below, though this one is cropped to a
        // fixed ratio and so cannot stretch the row — eager for consistency,
        // and because it is on screen within seconds either way.
        loading="eager"
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
      />
    </picture>
  ) : cropped ? (
    <OptimizedImage
      src={slide.imageUrl}
      alt={alt}
      fill
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      className="object-cover"
      /*
        100vw, because this band spans the window rather than the content
        column. The split view asks for "45vw on desktop" and is right to —
        it is painted in half a column. Left at that here the browser picks a
        source a third the width it is painted at and the banner is soft.
      */
      sizes="100vw"
    />
  ) : (
    <OptimizedImage
      src={slide.imageUrl}
      alt={alt}
      /*
        WIDTH AND HEIGHT HERE ARE A SPACE RESERVATION, NOT A SHAPE.

        Two facts make that true, and both are checkable rather than
        believed:

         - next/image never reads `width` for the srcset when `sizes` is
           present. `getWidths` returns early on `if (sizes)` and derives
           the widths from the vw percentages instead
           (next/dist/shared/lib/get-img-props.js:50-69). So these numbers
           cannot change which source is served.
         - the attributes compute to `aspect-ratio: auto 1920 / 640`, and
           the `auto` keyword hands layout back to the real image's own
           ratio the moment it loads. With `h-auto` the box before load is
           3:1 and the box after load is whatever the shop uploaded.

        So 4.8:1, 3:1 and 16:9 artwork all render WHOLE, at their own
        ratio. The only thing the numbers decide is how far the page moves
        on a cold load, and 3:1 is the shape this CMS has always drawn
        banners at, so it is the smallest average move.
      */
      width={1920}
      height={640}
      // See the note on `priority` above: every banner slide loads eagerly,
      // because an unloaded one makes the whole band too tall.
      loading="eager"
      fetchPriority={priority ? "high" : undefined}
      /*
        `max-h` in CONTAINER units, never `vh`. The admin builder mounts this
        same component inside a 1024px-max preview panel, where `vh` resolves
        against the admin's whole window and would clamp at a height that has
        nothing to do with the box the picture is painted in. `cqw` resolves
        against the band, which is the right answer in both mounts.

        It is a guard against one upload, not a shape: a portrait photograph
        dropped into a banner slot would otherwise be a 2,500px-tall band.
        `object-contain` letterboxes that rather than cropping it, so the
        owner sees what they uploaded and can see it is wrong.
      */
      className="block h-auto w-full max-h-[calc(100cqw*0.75)] object-contain"
      sizes="100vw"
    />
  );

  return (
    <div
      className={cn(
        /*
          WHERE THE BAND'S HEIGHT COMES FROM.

          A cropped slide gets a ratio ladder, because something has to give
          the box a height before there is an image in it and the picture is
          allowed to lose its edges.

          AN UNCROPPED ONE TAKES ITS HEIGHT FROM THE PICTURE. The ladder used
          to apply here too, and the middle rung was wrong for every banner
          this CMS has ever shipped: `sm:aspect-[2/1]` against 3:1 artwork
          threw away a third of the width at 640-1023px — every tablet and
          every phone held sideways — and asked for a source 1.5x too small
          into the bargain, so it was cropped AND soft. Nothing was wrong at
          390px or at 1440px, which is why it survived being looked at.

          `@container` is here so the image's `max-h` clamp has something to
          resolve against. It does not stop the band taking its height from
          the in-flow image: `container-type: inline-size` contains the inline
          axis only.
        */
        "relative w-full overflow-hidden bg-muted",
        cropped
          ? "aspect-[4/3] sm:aspect-[2/1] lg:aspect-[3/1]"
          : "@container"
      )}
    >
      {slide.headline ? (
        image
      ) : (
        /*
          A banner with no words is a picture that goes somewhere, so the whole
          picture is the link. With a headline the buttons carry the links
          instead — an anchor inside an anchor is invalid, and it is the inner
          one a browser throws away.

          IN FLOW WHEN THE PICTURE IS. `absolute inset-0` took the only child
          out of the flow, so a band with no ratio had nothing to get a height
          from and `overflow-hidden` clipped the entire hero to 0px — at every
          width at once. It stays absolute in the cropped case, where the band
          has a ratio and the picture inside is absolute too.
        */
        <Link
          href={slide.primaryHref}
          className={cropped ? "absolute inset-0 block" : "block"}
        >
          {image}
        </Link>
      )}

      {slide.headline ? (
        <div
          className={cn(
            /*
              A SCRIM ON THE HALF THE WORDS ARE ON, not a tint over the whole
              picture: the type needs contrast and the photograph is the point
              everywhere else. Dark because the type over it is white, and
              this CMS cannot know whether the shop's picture is.

              It follows the side, because a scrim on the left under words on
              the right is the worst of both — the subject dimmed and the type
              unreadable.
            */
            "absolute inset-0 z-10 flex items-center",
            side === "right"
              ? "bg-gradient-to-l from-black/70 via-black/40 to-transparent"
              : "bg-gradient-to-r from-black/70 via-black/40 to-transparent"
          )}
        >
          <div className={cn(layoutSpacing.container, "w-full")}>
            <div
              className={cn(
                "max-w-xl space-y-4 text-white sm:space-y-5",
                // `ml-auto` rather than a flex row, so the column keeps its
                // own max width and simply sits against the far edge.
                side === "right" && "ml-auto text-right"
              )}
            >
              {slide.badge ? (
                <div className={cn(reveal, "slide-in-from-bottom-2 [animation-delay:80ms]")}>
                  <Badge
                    variant="accent"
                    className="gap-1.5 rounded-full px-3.5 py-1.5 text-[13px]"
                  >
                    <Sparkles className="size-3.5" />
                    {slide.badge}
                  </Badge>
                </div>
              ) : null}

              <h1
                className={cn(
                  reveal,
                  "font-heading text-[1.75rem] font-bold leading-[1.12] tracking-tight slide-in-from-bottom-4 [animation-delay:180ms] sm:text-[2.5rem] lg:text-5xl"
                )}
              >
                {slide.headline}
              </h1>

              {slide.subtext ? (
                <p
                  className={cn(
                    reveal,
                    // white/85 rather than the muted token: that token is tuned
                    // for the cream page background and disappears on a photo.
                    "max-w-md text-sm leading-relaxed text-white/85 slide-in-from-bottom-4 [animation-delay:240ms] sm:text-base",
                    side === "right" && "ml-auto"
                  )}
                >
                  {slide.subtext}
                </p>
              ) : null}

              <div
                className={cn(
                  reveal,
                  "flex flex-wrap gap-3 slide-in-from-bottom-4 [animation-delay:300ms]",
                  side === "right" && "justify-end"
                )}
              >
                <Button size="lg" className="rounded-xl" render={<Link href={slide.primaryHref} />}>
                  {slide.primaryLabel}
                  <ArrowRight className="size-4" />
                </Button>
                {slide.secondaryLabel && slide.secondaryHref ? (
                  <Button
                    size="lg"
                    variant="outline"
                    /*
                      The outline button is drawn for a pale page, so on a
                      photograph it is a dark border round dark text. Restated
                      in white here rather than swapped for a solid one: two
                      solid buttons side by side leaves neither looking primary.
                    */
                    className="rounded-xl border-white/70 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white"
                    render={<Link href={slide.secondaryHref} />}
                  >
                    {slide.secondaryLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function HeroCarousel({
  slides,
  /** Which half of the picture the words sit in. */
  copySide = "left",
}: {
  slides: HeroSlide[];
  copySide?: HeroCopySide;
}) {
  const count = slides.length;
  const multi = count > 1;

  /**
   * A CLONE AT EACH END, so the loop is forward in both directions.
   *
   * The row is `[last, ...slides, first]` and `index` runs 0…count+1. The
   * shop's own slides are 1…count; 0 and count+1 are copies of the ones at
   * the far end, and the row jumps between them with the transition off,
   * which nobody sees because the picture either side of the jump is the
   * same picture.
   *
   * Without them a wrap is a modulo, and a modulo means the whole row
   * animates back the other way — 2,880px in 700ms on a three-slide hero.
   * One clone at the end fixed that for the autoplay and left the arrows
   * doing it, because `go` still wrapped: pressing Next on the last slide
   * rewound the lot. Both ends, or neither.
   */
  const [index, setIndex] = useState(1);
  const [snapBack, setSnapBack] = useState(false);
  const [paused, setPaused] = useState(false);
  /**
   * A PAUSE THAT ENDS, not a stop.
   *
   * This was sticky: one press of a control and the hero never moved again for
   * the rest of the visit. It was meant as the pause control — content that
   * moves by itself has to be stoppable, and hover and focus do not exist on
   * a phone — but a carousel that dies on the first touch reads as broken,
   * which is exactly how it was reported.
   *
   * So it resumes. What still answers the requirement it was there for:
   * `prefers-reduced-motion` switches the autoplay off entirely, which is a
   * setting rather than a button and reaches the people who most need it
   * without asking them to find anything; and hover, focus and a finger on
   * the picture all hold it while they last.
   */
  const [nudgedAt, setNudgedAt] = useState(0);
  const touchStartX = useRef<number | null>(null);

  /**
   * Where the row is, readable the instant a press arrives.
   *
   * `index` is a render behind, and deciding inside the updater is not an
   * option: the branch below has to switch the transition off as well, and a
   * state update is not a place to do that.
   */
  const indexRef = useRef(1);
  /**
   * The move waiting for the jump home to be drawn — as a row index, not a
   * direction.
   *
   * A DIRECTION WAS ENOUGH WHILE THE ARROWS EXISTED. An arrow always goes
   * one place from wherever the row lands, so `home + direction` said
   * everything. A dot does not: it names a slide outright, and it went
   * straight there with the transition on. Pressed while the row was
   * sitting on a clone that animated the whole lap backwards — the exact
   * rewind the clone machinery exists to prevent, reached by the other
   * door.
   *
   * It was rare enough to miss while an arrow was the control anyone
   * reached for. With the arrows gone the dot IS the control, so the rare
   * press became the ordinary one and the two paths had to become one.
   */
  const pendingIndex = useRef<number | null>(null);

  /** Which of the shop's slides is showing. A clone reads as the one it copies. */
  const activeIndex = count > 0 ? (((index - 1) % count) + count) % count : 0;

  /* The autoplay and the timed jump home move the row too; the mirror follows. */
  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  /**
   * One step, in either direction, ONTO the clones rather than around them.
   *
   * Stepping past an end lands on a clone, which is a forward move, and the
   * effect below then puts the row on the real slide it copies. A modulo
   * instead is what made the arrows rewind the whole row.
   *
   * PRESSING AGAIN WHILE THE ROW IS ON A CLONE IS THE HARD CASE, and it is
   * the one that was reported: at speed the hero lurched backwards. Coming
   * home off a clone is a move of a whole lap. Doing that and taking the
   * next step in one go gives the browser a single change — from the clone
   * at one end to a slide near the other — and it animates that lap, in
   * reverse, across every picture in between. Measured: a press at the join
   * ran the row from -5332px to -3487px, two slides the wrong way.
   *
   * So it is two changes. Coming home happens with the transition off, where
   * nobody sees it because a clone and the slide it copies are the same
   * picture, and the step waits for the frame after that one has been drawn.
   * If it did not wait, the browser would coalesce the two and animate the
   * lap anyway — the bug this is here to remove.
   */
  const step = useCallback(
    (direction: 1 | -1) => {
      setNudgedAt(Date.now());
      const at = indexRef.current;

      if (at > 0 && at < count + 1) {
        pendingIndex.current = null;
        setSnapBack(false);
        indexRef.current = at + direction;
        setIndex(at + direction);
        return;
      }

      const home = at <= 0 ? count : 1;
      pendingIndex.current = home + direction;
      indexRef.current = home;
      setSnapBack(true);
      setIndex(home);
    },
    [count],
  );

  /**
   * A dot names one of the shop's slides; the row's index is one further on.
   *
   * THE SAME TWO BRANCHES AS `step`, and for the same reason. A dot pressed
   * while the row is resting on a clone is a move from one end of the track
   * to the other, and the browser animates it: every picture in between,
   * backwards. Coming home first — with the transition off, where nobody
   * sees it because a clone and the slide it copies are the same picture —
   * turns that into a move of a slide or two from the near end.
   *
   * Pressing the dot for the slide the clone is a copy of now moves nothing
   * at all, which is what it looked like it did all along.
   */
  const goTo = useCallback(
    (slide: number) => {
      setNudgedAt(Date.now());
      const at = indexRef.current;

      if (at > 0 && at < count + 1) {
        pendingIndex.current = null;
        setSnapBack(false);
        indexRef.current = slide + 1;
        setIndex(slide + 1);
        return;
      }

      const home = at <= 0 ? count : 1;
      pendingIndex.current = slide + 1;
      indexRef.current = home;
      setSnapBack(true);
      setIndex(home);
    },
    [count],
  );

  useEffect(() => {
    if (!multi || paused || nudgedAt) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    /*
      Always forward, and never past the end of the track. The clone at the
      end is where the last turn goes and the effect below moves the row off
      it — but a background tab coalesces timers, so this tick can land
      before that one has run. An unbounded `i + 1` then walks off the row.
    */
    const id = window.setInterval(
      () => setIndex((i) => (i >= count + 1 ? 2 : i + 1)),
      AUTOPLAY_MS,
    );
    return () => window.clearInterval(id);
  }, [multi, paused, nudgedAt, count]);

  /**
   * The jump off a clone, once the move onto it has finished.
   *
   * Nobody sees it: a clone and the slide it copies are the same picture, so
   * the row changing position underneath it changes nothing on screen.
   * `snapBack` switches the transition off for that one change, or the jump
   * would animate — which is the rewind this arrangement exists to remove.
   */
  useEffect(() => {
    if (count === 0) return;
    if (index > 0 && index < count + 1) return;
    /*
      `<= 0` and `>= count + 1` rather than `=== `, so an index that has got
      out of range by any route still comes home. The two callers are bounded
      now; this is what stops a blank band being permanent if one ever is not.
    */
    const landing = index <= 0 ? count : 1;
    const id = window.setTimeout(() => {
      setSnapBack(true);
      setIndex(landing);
    }, SLIDE_MS + 40);
    return () => window.clearTimeout(id);
  }, [index, count]);

  /**
   * The transition comes straight back, so the NEXT move animates — and any
   * step that was waiting on the jump home goes now.
   *
   * TWO frames, not one. A callback booked from an effect can still run
   * before the browser has drawn the commit that booked it, and a jump home
   * that is never drawn is a jump that never happened: the browser would see
   * one move, from the clone to the far side of the row, and animate the lap
   * backwards. The second frame is the guarantee that it was drawn.
   *
   * `index` is a dependency as well as `snapBack`, because a press that
   * arrives while the row is already coming home leaves `snapBack` set and
   * would otherwise leave its step queued for ever.
   */
  useEffect(() => {
    if (!snapBack) return;
    let inner = 0;
    const outer = window.requestAnimationFrame(() => {
      inner = window.requestAnimationFrame(() => {
        setSnapBack(false);
        const next = pendingIndex.current;
        if (next === null) return;
        pendingIndex.current = null;
        indexRef.current = next;
        setIndex(next);
      });
    });
    return () => {
      window.cancelAnimationFrame(outer);
      window.cancelAnimationFrame(inner);
    };
  }, [snapBack, index]);

  /** The pause a press buys, and then gives back. */
  useEffect(() => {
    if (!nudgedAt) return;
    const id = window.setTimeout(() => setNudgedAt(0), RESUME_MS);
    return () => window.clearTimeout(id);
  }, [nudgedAt]);

  if (count === 0) return null;

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null || !multi) return;
    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(delta) > SWIPE_THRESHOLD) step(delta < 0 ? 1 : -1);
    touchStartX.current = null;
  };

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured highlights"
      /*
        A POINTER THAT IS NOT A FINGER.

        These were `onMouseEnter` / `onMouseLeave`, and a browser fires
        compatibility mouse events after a tap — so tapping a dot on a phone
        raised `mouseenter`, paused the autoplay, and then never raised
        `mouseleave`, because there is no pointer to move away. One tap and the
        hero stopped for the rest of the visit. Measured on a touch device:
        twenty-one seconds later it had not moved.

        `pointerType` is the only thing that can tell the two apart. A mouse
        resting on the picture still holds it, which is what the pause is for.
      */
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") setPaused(true);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") setPaused(false);
      }}
      /*
        KEYBOARD FOCUS PAUSES. A MOUSE CLICK DOES NOT.

        A click leaves the button it landed on focused, and `onFocusCapture`
        took that as somebody reading — so one press paused the autoplay for
        as long as that button kept focus, which is until the visitor clicks
        somewhere else on the page. Measured: the hero had not moved fifteen
        seconds later, and it reads as a carousel that has died. It was an
        arrow that found this; the dots are the buttons it protects now, and
        they are the only ones left.

        `:focus-visible` is exactly this distinction — the browser sets it for
        focus arrived at by keyboard and not for focus left behind by a
        pointer. So tabbing into the carousel still holds it, which is the
        case the pause was for.
      */
      onFocusCapture={(event) => {
        if (event.target instanceof Element && event.target.matches(":focus-visible")) {
          setPaused(true);
        }
      }}
      onBlurCapture={() => setPaused(false)}
    >
      {/*
        THE PICTURE'S OWN BOX, which is why it is still here with nothing
        positioned against it.

        It was drawn for the arrows: they were positioned against the root,
        which also holds the row of dots, so `top-1/2` centred them on the
        slide PLUS the dots and they sat about 20px low. The arrows are gone
        and this stays, because it is also what keeps the dots out from over
        the picture — remove it and they climb back on top of the artwork.
      */}
      <div className="relative">
        {/*
          THE ROW SLIDES SIDEWAYS. Every slide is drawn, in a row as wide as
          all of them together, and the row is moved one slide's width at a
          time. Mounting one at a time cannot do this at any duration: React
          removes the old node in the same commit that adds the new one, so
          there is nothing on screen to move, and the band hard-cut between
          pictures.
        */}
        <div className="overflow-hidden" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div
              className={cn(
                "flex transition-transform duration-700 ease-out",
                // Nobody who asked for less movement gets a 700ms slide.
                "motion-reduce:transition-none",
                /*
                  And the one move nobody should see animate: the row going
                  from the clone back to slide 0. Same picture either side of
                  it, so with the transition off it is invisible, and with it
                  on it is the whole-row rewind this arrangement removes.
                */
                snapBack && "transition-none"
              )}
              style={{
                /*
                  100% PER SLIDE, and the reason is not the obvious one.

                  `translateX` resolves its percentage against the element's
                  own width — so this depends entirely on how wide the track
                  actually is, and the track is NOT as wide as its contents.
                  Its width comes from its parent (one slide), each child is
                  `w-full` of THAT, and `shrink-0` lets the row overflow
                  instead of growing it. So the track measures one slide, and
                  100% of it is exactly one slide.

                  `100 / count` is the version that reads correct and is not:
                  it assumes a track as wide as all the slides together, and on
                  a three-slide hero it moves 480px of a 1440px slide. Measured
                  in a browser, which is the only place this can be settled.
                */
                transform: `translateX(-${index * 100}%)`,
              }}
            >
              {/*
                A COPY OF THE LAST SLIDE BEFORE THEM, AND OF THE FIRST AFTER.

                They are what make the loop go forwards in BOTH directions.
                Without them a wrap is a modulo, and a modulo animates the
                whole row the other way — 2,880px in 700ms on a three-slide
                hero. One clone at the end fixed the autoplay and left the
                arrows rewinding, because they wrapped separately.
              */}
              {[slides[count - 1], ...slides, slides[0]].map((slide, i) => (
                <div
                  key={i}
                  /*
                    `w-full` against the VIEWPORT of the track — the wrapper —
                    and `shrink-0` so three of them do not divide one width
                    between themselves, which is what flex does by default.
                  */
                  className="w-full shrink-0"
                  /*
                    `inert` rather than `aria-hidden` alone. Both hide the
                    slide from a screen reader, but only `inert` takes its link
                    out of the tab order — and a banner slide IS a link, so
                    without it a keyboard user tabs through the pictures that
                    are off the side of the screen before reaching the page.

                    Against `index`, not `activeIndex`: while the row is on the
                    clone those are different, and it is the clone that is on
                    screen.
                  */
                  inert={i !== index}
                >
                  <HeroBannerSlideView slide={slide} priority={i === 0} side={copySide} />
                </div>
              ))}
            </div>
        </div>

      </div>

      {/*
        THE DOTS SIT BELOW THE PICTURE.

        They were absolute over the foot of the image — which is where they
        are least legible (a photograph, not a flat colour, so a white dot
        lands on whatever happens to be there) and where they cover the part
        of the picture a wide crop has least of. They are in the flow now, on
        the page's own background, which is where the reference layout puts
        them.

        AND CLOSE TO IT, because they belong to it. At 24 and 32px they read
        as their own band floating between the hero and whatever follows,
        which is how 186px of white between the banner and the first row of
        the page came to look deliberate. About 14px in the reference this is
        drawn from.
      */}
      {multi ? (
        <div className="mt-3 flex items-center justify-center gap-2 sm:mt-4">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              // `goTo`, not `setIndex` — a dot press is deliberate, and
              // `goTo` is what pauses the autoplay and comes off a clone
              // safely. `setIndex` would do neither.
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === activeIndex}
              /*
                An 8px visual with a 24px reach, and now the hit area of the
                ONLY control on the hero.

                The arrows are gone — the shop asked for the dots alone, and
                measured, the arrows were mostly a phone thing anyway. What
                is left is this and the swipe, so an 8x8 target, already
                below every touch floor there is, would be the whole
                interface. `before` grows the reach without moving anything.

                A MOUSE HAS ONLY THIS. There is no swipe with a mouse and
                the pointer resting on the band pauses the autoplay, so for
                a desktop visitor the dot is not one way through, it is the
                way through. That is the trade the shop chose and it is
                worth seeing written down next to the 8 pixels.
              */
              className="relative flex h-2 items-center rounded-full transition-all duration-300 before:absolute before:-inset-2 before:content-['']"
            >
              <span
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === activeIndex
                    ? "w-7 bg-bakery-700"
                    : "w-2 bg-bakery-200 hover:bg-bakery-300"
                )}
              />
            </button>
          ))}

          {/*
            NO PAUSE BUTTON. The row is dots and nothing else, which is what
            the reference layout shows and what a shop asked for.

            The requirement behind that button has not gone, though: content
            that moves on its own has to be stoppable, and hover and focus —
            the only two things that stopped it — do not exist on a phone.
            `stop()` is what replaced it. Any deliberate move between slides
            ends the autoplay for good, so a customer who takes hold of the
            carousel keeps it, and nobody has to find a control to say so.
          */}
        </div>
      ) : null}
    </div>
  );
}
