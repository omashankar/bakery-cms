"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * The one part of a tabbed rail that has to run in the browser: which tab is
 * chosen.
 *
 * The band around it — heading, link, and every tab's row of products — is
 * drawn on the server and handed in as finished markup, so switching a tab
 * swaps panels that are already here instead of shipping the renderer (every
 * homepage section type) to the browser to draw them.
 */
export function TabbedRailTabs({
  tabLabels,
  inlineHeading,
  link,
  panels,
}: {
  tabLabels: string[];
  /** The heading when it stands beside the tabs (left-ranged bands). */
  inlineHeading: React.ReactNode;
  /** The "view all" link at the end of the line. */
  link: React.ReactNode;
  /** One row of products per tab, in tab order. */
  panels: React.ReactNode[];
}) {
  /**
   * The tab INDEX, not its slug.
   *
   * A shop can legitimately point two tabs at one category — "Under ₹500"
   * and "Gifts" can both be Gifts while the labels differ — and keying by
   * slug would make clicking one light up the other.
   */
  const [active, setActive] = useState(0);
  const current = Math.min(active, panels.length - 1);

  return (
    <>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-border sm:flex-nowrap sm:gap-x-5 sm:gap-y-0">
        {inlineHeading}
        {/*
          The tabs scroll sideways rather than wrapping: four tabs on a
          phone wrap to two lines and move the grid down the page every
          time one is pressed.
        */}
        {/*
          BOXES, and the chosen one is filled.

          They were pale pills inside a pill, which on a tinted band left
          the chosen tab and the unchosen ones at almost the same weight.
          Filled-dark against outlined-white reads at a glance, and the
          little pointer under the chosen one ties it to the row below —
          which is the whole reason a tab is not just a filter chip.

          SIZED LIKE A CHOICE, not like a filter chip. The shop held the
          layout up beside this and the tabs there are the second-largest
          thing on the line after the heading — text at the body size,
          not the small one, and enough padding round it to be an obvious
          target on a phone.

          THE FILL IS NEUTRAL, not the brand. `--foreground` is the
          page's own ink, so the chosen tab is the same dark as the
          heading beside it whatever palette the shop picks — and on a
          tinted band a brand-coloured fill competes with the tint it
          sits on. The pointer takes the same colour, because it is the
          tab's own corner rather than a decoration.
        */}
        {/*
          `pb-2 -mb-2` is room for the pointer, not spacing.

          `overflow-x-auto` clips BOTH axes — a box that scrolls sideways
          cuts anything below it too — so the pointer hanging under the
          chosen tab simply disappeared. The padding gives it somewhere to
          be inside the clip and the negative margin puts the strip back
          where it was, so the tabs still stand on the rule.
        */}
        <div className="no-scrollbar order-last -mb-2 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-2 sm:order-none sm:w-auto">
          {tabLabels.map((label, index) => (
            <button
              key={`${label}-${index}`}
              type="button"
              onClick={() => setActive(index)}
              aria-pressed={index === current}
              className={cn(
                /*
                  `-mb-px` pulls the tab down over the row's rule so its
                  own fill covers that one pixel — which is what makes an
                  unchosen tab open into the line instead of being boxed
                  off from it. Square at the foot for the same reason: a
                  rounded bottom corner leaves a notch of rule showing
                  through beside it.
                */
                "relative -mb-px shrink-0 rounded-t-md border px-5 py-2.5 text-base font-semibold",
                index === current
                  ? "border-foreground bg-foreground text-background"
                  : "border-border border-b-transparent bg-card text-foreground"
              )}
            >
              {label}
              {index === current ? (
                <span
                  aria-hidden="true"
                  className="absolute -bottom-1.5 left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-foreground"
                />
              ) : null}
            </button>
          ))}
        </div>
        <div className="ml-auto shrink-0 pb-2.5">{link}</div>
      </div>
      {panels[current]}
    </>
  );
}
