"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A product name held to two lines, with "more" to read the rest.
 *
 * The shop's reference: a long name ("DUCE Back Cover for Apple iPhone 15
 * Plus (Transparent, Dual Prote…more") keeps the price and the rating where
 * the eye expects them instead of pushing them down a phone screen.
 *
 * "more" appears only when the name is actually cut — measured in the
 * browser, where the lines are known; on the server the name renders in full
 * height-capped by CSS, so nothing moves when the measurement lands except
 * the word "more" appearing.
 */
export function ClampedTitle({
  text,
  className,
  as: Heading = "h2",
}: {
  text: string;
  className?: string;
  /** `h1` where the name IS the page — the product page. */
  as?: "h1" | "h2";
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [cut, setCut] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || expanded || typeof ResizeObserver === "undefined") return;
    // Fires once on observe and again whenever the width changes.
    const observer = new ResizeObserver(() => {
      setCut(node.scrollHeight > node.clientHeight + 1);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [expanded, text]);

  return (
    <div className="relative">
      <Heading ref={ref} className={cn(className, !expanded && "line-clamp-2")}>
        {text}
      </Heading>
      {/*
        At the end of the second line, as in the reference, sitting over the
        clamp's own ellipsis — its background hides that one, so the line
        reads "Prote…more" rather than "Prote……more".
      */}
      {cut && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label={`Show the full name: ${text}`}
          className="absolute right-0 bottom-0 bg-background pl-1 text-base font-medium text-blue-600 hover:underline"
        >
          …more
        </button>
      ) : null}
    </div>
  );
}
