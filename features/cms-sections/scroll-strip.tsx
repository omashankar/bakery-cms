"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A ROW THAT SCROLLS. The arrows are the exception, not the way through.
 *
 * TWO CONDITIONS, and both have to hold. The strip has to actually
 * overflow — a row of four in a space that fits four has nowhere to go,
 * and a pair of dead chevrons either side of it is a control that lies
 * about what it does. And the window has to be wider than a laptop.
 *
 * The second one is the shop's decision and it is worth writing down what
 * it costs, because measuring the page first made it look like the
 * opposite of what it is. At 390px twelve rows on the homepage overflow;
 * from 1024px up exactly one does, by about 300px. So these arrows live
 * almost entirely on phones and tablets, which is the one place they are
 * least use: a finger already drags the row, and the chevrons sit on top
 * of the cards to say so.
 *
 * WHAT IT COSTS is that one row, below 1400, driven by a mouse. There is
 * no arrow and no visible bar there, and a wheel scrolls a page down
 * rather than a row sideways — so a trackpad or a touchscreen reaches the
 * fifth card and a plain mouse does not. It is one row and about half a
 * card; hijacking the wheel to fix it would take the page's own scrolling
 * away from everybody, which is the worse trade.
 */
export function ScrollStrip({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ back: false, forward: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 1px of slack: sub-pixel widths make an exactly-fitting row report a
    // scrollWidth a fraction larger than its client width.
    setCanScroll({
      back: el.scrollLeft > 1,
      forward: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, children]);

  const step = (direction: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    // A little under a full screen, so the card at the edge stays in view
    // and a customer does not lose their place.
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  /*
    INSIDE THE STRIP, not straddling its edge.

    They sat at `left-0 -translate-x-1/2`, half outside — which is how the
    layout draws them, and which on a phone pushed 2px past the window on
    five rows at once and gave the whole page a horizontal scrollbar.
    Measured at 360, 390 and 430: scrollWidth 2px over the viewport.

    A carousel arrow overlapping the first card is ordinary; a page that
    slides sideways is not.
  */
  /*
    1400, AND IT IS THE SHOP'S NUMBER — used here and on the hero, so the
    two sets of arrows appear and disappear together rather than the page
    growing controls in two stages.

    It does not line up with a Tailwind breakpoint on purpose. `xl` is
    1280, which is a small laptop and below the line the shop drew; `2xl`
    is 1536, and a 1920px laptop at the 125% scaling Windows ships by
    default reports exactly 1536 CSS pixels, so cutting there would put
    the arrows back on the commonest laptop of all. 1400 sits between the
    two.

    44px, not 36. A 36px circle over a card is a small target for a
    pointer and under the floor for anything else, and these now only
    appear on the screens with the most room for them.

    `hidden` and not `invisible` or `opacity-0`: the button has to leave
    the tab order too, or a keyboard reaches a control nobody can see.
  */
  const arrow =
    "absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md min-[1400px]:flex";

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={measure}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 sm:gap-5"
      >
        {children}
      </div>
      {canScroll.back ? (
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous"
          className={cn(arrow, "left-1")}
        >
          <ChevronLeft className="size-5" />
        </button>
      ) : null}
      {canScroll.forward ? (
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next"
          className={cn(arrow, "right-1")}
        >
          <ChevronRight className="size-5" />
        </button>
      ) : null}
    </div>
  );
}
