"use client";

import { OptimizedImage } from "@/components/shared/optimized-image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Sparkles,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { layoutSpacing } from "@/constants/spacing";
import type { HeroCopySide, HeroLayout } from "@/types/homepage-builder";
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
const SWIPE_THRESHOLD = 48;

/** Staggered entrance — CSS driven, always settles visible (fill-mode both). */
const reveal =
  "animate-in fade-in-0 duration-700 [animation-fill-mode:both] motion-reduce:animate-none";

/** Tints the final word of the headline in the brand tone for a subtle two-tone pop. */
function accentLastWord(headline: string) {
  const words = headline.trim().split(/\s+/);
  if (words.length < 2) return headline;
  const last = words[words.length - 1];
  const rest = words.slice(0, -1).join(" ");
  return (
    <>
      {rest} <span className="text-bakery-600">{last}</span>
    </>
  );
}

function HeroSlideView({
  slide,
  priority,
  rating,
  stats = [],
}: {
  slide: HeroSlide;
  priority?: boolean;
  /** The shop's approved-review figures, or null for no chip. */
  rating?: { count: number; average: number } | null;
  /** The shop's own stats strip. Empty renders no strip. */
  stats?: { value?: string; label?: string }[];
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
      {/* Copy — left on phones, centred on tablet (fills the single column), split-left on desktop */}
      <div className="space-y-6 text-left sm:text-center lg:text-left">
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

        <div
          className={cn(
            reveal,
            "space-y-4 slide-in-from-bottom-4 [animation-delay:180ms]"
          )}
        >
          {/* Guarded like the badge above and the subtext below. A slide can
              reach here with an empty headline — the section filter admits any
              slide that has EITHER a headline or an image — and an unguarded
              h1 then rendered as an empty heading block with full type styling
              on it, which is worse than no heading. */}
          {slide.headline ? (
            <h1 className="font-heading text-[2.25rem] font-bold leading-[1.1] tracking-tight text-bakery-950 sm:text-[2.75rem] lg:text-5xl">
              {accentLastWord(slide.headline)}
            </h1>
          ) : null}
          {slide.subtext ? (
            <p className="max-w-md text-base leading-relaxed text-muted-foreground sm:mx-auto sm:text-lg lg:mx-0">
              {slide.subtext}
            </p>
          ) : null}
        </div>

        <div
          className={cn(
            reveal,
            "flex flex-wrap gap-3 slide-in-from-bottom-4 [animation-delay:300ms] sm:justify-center lg:justify-start"
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
              className="rounded-xl"
              render={<Link href={slide.secondaryHref} />}
            >
              {slide.secondaryLabel}
            </Button>
          ) : null}
        </div>

        {/*
          The stats strip, from the shop's own figures.

          It was a constant — "1M+ Happy customers · 500+ Cake varieties · 60+
          Years of joy" — the demo brand's numbers shown as whichever shop runs
          this CMS, with no field to change them. Empty renders no strip: a
          border-topped band of nothing is worse than no band.
        */}
        {stats.length > 0 ? (
          <div
            className={cn(
              reveal,
              "grid max-w-md gap-4 border-t border-border pt-6 slide-in-from-bottom-4 [animation-delay:400ms] sm:mx-auto lg:mx-0"
            )}
            style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 3)}, minmax(0, 1fr))` }}
          >
            {stats.map((stat, index) => (
              <div key={`${stat.label}-${index}`}>
                {stat.value ? (
                  <p className="font-heading text-2xl font-bold text-bakery-800 sm:text-3xl">
                    {stat.value}
                  </p>
                ) : null}
                {stat.label ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Visual */}
      <div
        className={cn(
          reveal,
          "relative mx-auto w-full max-w-lg zoom-in-95 [animation-delay:120ms] lg:max-w-none"
        )}
      >
        <div className="rounded-[2rem] border border-border bg-cream-100 p-2.5 shadow-md">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-muted sm:aspect-[3/2] lg:aspect-[4/3]">
            {slide.imageUrl ? (
              <OptimizedImage
                src={slide.imageUrl}
                // The shop's own description first here too. The headline is
                // real text in the column beside this frame, so repeating it
                // is the second-best answer, not the first.
                alt={slide.imageAlt?.trim() || slide.headline}
                fill
                priority={priority}
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 45vw"
              />
            ) : null}
          </div>
        </div>

        {/*
          THE "100% FRESH" PILL IS GONE.

          It sat pinned to the corner of every hero image, on every slide, for
          every shop running this CMS, with no box anywhere to edit or remove
          it — a claim about goods this CMS knows nothing about, made in the
          shop's name. A shop that wants to say it can now write it in the
          promises strip under the hero, in its own words.
        */}

        {/*
          Rating chip — the shop's own approved reviews, or no chip.

          This read "4.9 Rating · 2000+ reviews" as a constant on every slide.
          Both numbers were invented: the real figures come from the approved
          review aggregate, and on this shop they are 4.7 across 27. A shop with
          nothing approved now shows nothing, rather than borrowing a score.
        */}
        {rating ? (
          <div
            className={cn(
              reveal,
              "absolute bottom-4 left-4 flex items-center gap-2.5 rounded-2xl border border-border bg-white/95 p-2.5 shadow-sm zoom-in-90 [animation-delay:660ms]"
            )}
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-gold-100 text-gold-700">
              <Star className="size-4 fill-current" />
            </span>
            <div>
              <p className="text-sm font-bold leading-none text-foreground">
                {rating.average} Rating
              </p>
              <p className="mt-1 text-[11px] leading-none text-muted-foreground">
                {rating.count} review{rating.count === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * THE BANNER SLIDE — here the picture IS the slide.
 *
 * A second view rather than a handful of props on the one above, because
 * almost nothing survives between them: no framed card, no rounding, no
 * two-column grid, no max width, different crops at every breakpoint, and the
 * words sit ON the image instead of beside it. Six conditionals threaded
 * through HeroSlideView would leave neither layout readable, and the split
 * hero is what every existing shop is still showing.
 */
function HeroBannerSlideView({
  slide,
  priority,
  side,
}: {
  slide: HeroSlide;
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
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
      />
    </picture>
  ) : (
    <OptimizedImage
      src={slide.imageUrl}
      alt={alt}
      fill
      priority={priority}
      className="object-cover"
      /*
        100vw, because this band spans the window rather than the content
        column. The split view asks for "45vw on desktop" and is right to —
        it is painted in half a column. Left at that here the browser picks a
        source a third the width it is painted at and the banner is soft.
      */
      sizes="100vw"
    />
  );

  return (
    <div
      className={cn(
        /*
          WHAT SHAPE THE PHONE GETS, and why it is not one answer.

          Wide everywhere is right when the picture IS the message and there
          is no phone version of it: a 3:1 graphic cropped to a phone's box
          loses its sides, and on a banner with its words in the right half,
          the words are the side that goes. Short and complete beats tall and
          truncated — and the shop can see that it is short, which is the
          nudge towards uploading a phone picture.

          Taller on a phone is right in the other two cases. With a phone
          picture, that picture was composed for this box. With a headline,
          the words are real text laid over the photograph and they need the
          room — cropping a photograph is what `object-cover` is for.
        */
        "relative w-full overflow-hidden bg-muted sm:aspect-[2/1] lg:aspect-[3/1]",
        mobile || slide.headline ? "aspect-[4/3]" : "aspect-[3/1]"
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
        */
        <Link href={slide.primaryHref} className="absolute inset-0 block">
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

/**
 * The slide to show, given an index that may have outlived the list.
 *
 * `index` is component state and survives a shrinking `slides` prop. Autoplay
 * walks it to the last slide within seconds while the admin's cursor is over the
 * editor panel, so deleting the last slide left `slides[index]` undefined and the
 * very next line — `slide.badge` inside HeroSlideView — threw. That happens in
 * the builder's live preview, which has no error boundary, so the crash unmounted
 * the builder and took every unsaved edit with it.
 *
 * Pulled out as a function because this repo has no React renderer in its test
 * setup: this is the part that can be pinned by a test.
 */
export function activeSlideIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  if (index < 0) return 0;
  return index < count ? index : count - 1;
}

export function HeroCarousel({
  slides,
  /**
   * The shop's own approved-review figures, or null.
   *
   * The chip below said "4.9 Rating · 2000+ reviews" as a constant, on every
   * slide, for every shop running this CMS — on this one the real numbers are
   * 4.7 across 27 approved reviews. Null (a shop with none approved, or the
   * builder preview, which has no server data) renders no chip at all rather
   * than an invented score.
   */
  rating = null,
  stats = [],
  /**
   * Which of the two views to draw, defaulted to the one every shop has.
   *
   * The default is here as well as at the renderer's read because this
   * component is exported and mounted from more than one place; a caller that
   * has never heard of the key gets the hero it was already drawing.
   */
  layout = "split",
  /**
   * Which half of a banner the words sit in.
   *
   * Only the banner reads it — the split layout is already a two-column grid
   * whose sides are fixed by the grid itself.
   */
  copySide = "left",
}: {
  slides: HeroSlide[];
  rating?: { count: number; average: number } | null;
  /** The shop's own stats strip, from the hero section's `stats` field. */
  stats?: { value?: string; label?: string }[];
  layout?: HeroLayout;
  copySide?: HeroCopySide;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = slides.length;
  const multi = count > 1;
  const banner = layout === "banner";

  const go = useCallback((next: number) => setIndex((next + count) % count), [count]);

  useEffect(() => {
    if (!multi || paused) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [multi, paused, count]);

  if (count === 0) return null;

  // Clamped, because the slide list changes under this component while an admin
  // edits it — see activeSlideIndex.
  const activeIndex = activeSlideIndex(index, count);
  const active = slides[activeIndex];

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null || !multi) return;
    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(delta) > SWIPE_THRESHOLD) go(activeIndex + (delta < 0 ? 1 : -1));
    touchStartX.current = null;
  };

  return (
    <div
      className="relative"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/*
        THE ARROWS BELONG TO THE SLIDE, not to the whole carousel.

        They were positioned against the root, which also holds the row of
        dots — so `top-1/2` centred them on the slide PLUS the dots, and the
        split hero's arrows sat about 20px below the middle of the card they
        point at. Their own `relative` box fixes it for both layouts, and is
        what lets the dots move out from over the picture.
      */}
      <div className="relative">
        <div className="grid" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {/* key forces a fresh mount per slide so the staggered entrance replays */}
          <div key={activeIndex} className="col-start-1 row-start-1">
            {banner ? (
              <HeroBannerSlideView
                slide={active}
                priority={activeIndex === 0}
                side={copySide}
              />
            ) : (
              <HeroSlideView
                slide={active}
                priority={activeIndex === 0}
                rating={rating}
                stats={stats}
              />
            )}
          </div>
        </div>

        {multi ? (
          <>
            {/*
              WHERE THE ARROWS SIT depends on whether there is a gutter beside
              the slide to sit in.

              The split hero is a card inside the content column, so its arrows
              park in the page margin — and only from 2xl, the first width
              where that margin is wide enough to hold them. The banner runs to
              both edges of the window and has no margin at all, so its arrows
              go over the picture, and they show at every width because a swipe
              is otherwise the only way to reach slide two and nothing on the
              screen says it is there.

              BUT NOT ACROSS THE WORDS. At 390px a 44px button centred
              vertically lands on the headline and takes the first 40px of the
              line with it — the text is unreadable underneath and untappable
              through it. Below sm the banner's pair drops to the foot of the
              picture, clear of the copy; from sm there is room at the sides
              and they take their inset position.
            */}
            <button
              type="button"
              onClick={() => go(activeIndex - 1)}
              aria-label="Previous slide"
              className={cn(
                "absolute z-20 size-11 items-center justify-center rounded-full border shadow-md transition-all hover:scale-105",
                banner
                  ? "bottom-3 left-3 flex border-white/40 bg-white/85 text-bakery-800 backdrop-blur-sm hover:bg-white sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:left-5"
                  : "top-1/2 left-0 hidden -translate-y-1/2 translate-x-[calc(-100%-1.25rem)] border-border bg-white text-bakery-700 hover:bg-cream-100 hover:text-bakery-800 2xl:flex"
              )}
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => go(activeIndex + 1)}
              aria-label="Next slide"
              className={cn(
                "absolute z-20 size-11 items-center justify-center rounded-full border shadow-md transition-all hover:scale-105",
                banner
                  ? "bottom-3 right-3 flex border-white/40 bg-white/85 text-bakery-800 backdrop-blur-sm hover:bg-white sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 sm:right-5"
                  : "top-1/2 right-0 hidden -translate-y-1/2 translate-x-[calc(100%+1.25rem)] border-border bg-white text-bakery-700 hover:bg-cream-100 hover:text-bakery-800 2xl:flex"
              )}
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
      </div>

      {/*
        THE DOTS SIT BELOW THE PICTURE, in both layouts.

        The banner's were absolute over the foot of the image — which is where
        they are least legible (a photograph, not a flat colour, so a white dot
        lands on whatever happens to be there) and where they cover the part of
        the picture a wide crop has least of. They are in the flow now, on the
        page's own background, which is where the reference layout puts them
        and where the split hero already had them; so the two layouts share one
        row and one palette instead of keeping a light set nobody could see.
      */}
      {multi ? (
        <div className="mt-6 flex items-center justify-center gap-2 sm:mt-8">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === activeIndex}
              /*
                An 8px visual with a 24px reach. The dot is the only way to
                change slide on a phone in the split layout — its arrows are
                2xl-only — and an 8x8 target is below every touch floor there
                is. `before` grows the hit area without moving anything.
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
            A PAUSE THE TOUCH USER CAN REACH.

            Autoplay already stops on hover and on focus, and a phone has
            neither — so on the device most of this shop's customers use, a
            slide that moves every six seconds could not be stopped at all.
            An icon and a label, no copy.
          */}
          <button
            type="button"
            onClick={() => setPaused((was) => !was)}
            aria-label={paused ? "Resume slideshow" : "Pause slideshow"}
            className="ml-2 flex size-8 items-center justify-center rounded-full text-muted-foreground transition-premium hover:bg-cream-100 hover:text-bakery-700"
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          </button>
        </div>
      ) : null}
    </div>
  );
}
