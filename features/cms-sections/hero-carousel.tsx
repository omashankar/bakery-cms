"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
}

const heroStats = [
  { value: "1M+", label: "Happy customers" },
  { value: "500+", label: "Cake varieties" },
  { value: "60+", label: "Years of joy" },
] as const;

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

function HeroSlideView({ slide, priority }: { slide: HeroSlide; priority?: boolean }) {
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
          <h1 className="font-heading text-[2.25rem] font-bold leading-[1.1] tracking-tight text-bakery-950 sm:text-[2.75rem] lg:text-5xl">
            {accentLastWord(slide.headline)}
          </h1>
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

        <div
          className={cn(
            reveal,
            "grid max-w-md grid-cols-3 gap-4 border-t border-border pt-6 slide-in-from-bottom-4 [animation-delay:400ms] sm:mx-auto lg:mx-0"
          )}
        >
          {heroStats.map((stat) => (
            <div key={stat.label}>
              <p className="font-heading text-2xl font-bold text-bakery-800 sm:text-3xl">
                {stat.value}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
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
              <Image
                src={slide.imageUrl}
                alt={slide.headline}
                fill
                priority={priority}
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 45vw"
              />
            ) : null}
          </div>
        </div>

        {/* Freshness badge */}
        <div
          className={cn(
            reveal,
            "absolute top-4 right-4 flex items-center gap-1.5 rounded-full border border-border bg-white/95 px-3 py-1.5 shadow-sm zoom-in-90 [animation-delay:560ms]"
          )}
        >
          <BadgeCheck className="size-4 text-green-600" />
          <span className="text-xs font-semibold text-foreground">100% Fresh</span>
        </div>

        {/* Rating chip */}
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
            <p className="text-sm font-bold leading-none text-foreground">4.9 Rating</p>
            <p className="mt-1 text-[11px] leading-none text-muted-foreground">
              2000+ reviews
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const count = slides.length;
  const multi = count > 1;

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

  const active = slides[index];

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null || !multi) return;
    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(delta) > SWIPE_THRESHOLD) go(index + (delta < 0 ? 1 : -1));
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
      <div className="grid" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* key forces a fresh mount per slide so the staggered entrance replays */}
        <div key={index} className="col-start-1 row-start-1">
          <HeroSlideView slide={active} priority={index === 0} />
        </div>
      </div>

      {multi ? (
        <>
          {/* Sits fully outside the content column (in the page gutter), vertically centred */}
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous slide"
            className="absolute top-1/2 left-0 z-20 hidden size-11 -translate-y-1/2 translate-x-[calc(-100%-1.25rem)] items-center justify-center rounded-full border border-border bg-white text-bakery-700 shadow-md transition-all hover:scale-105 hover:bg-cream-100 hover:text-bakery-800 xl:flex"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next slide"
            className="absolute top-1/2 right-0 z-20 hidden size-11 -translate-y-1/2 translate-x-[calc(100%+1.25rem)] items-center justify-center rounded-full border border-border bg-white text-bakery-700 shadow-md transition-all hover:scale-105 hover:bg-cream-100 hover:text-bakery-800 xl:flex"
          >
            <ChevronRight className="size-5" />
          </button>

          <div className="mt-8 flex items-center justify-center gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  i === index
                    ? "w-7 bg-bakery-700"
                    : "w-2 bg-bakery-200 hover:bg-bakery-300"
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
