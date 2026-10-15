"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Mounts its children only once the box is about to scroll into view.
 *
 * For embeds whose cost lands on the page that merely CONTAINS them. The
 * contact page's Google Map is an iframe with `loading="lazy"`, but Chrome's
 * lazy threshold is over a thousand pixels on a phone, so the map loaded with
 * the page anyway and its scripts took ~650ms of a throttled phone's main
 * thread during load — the single largest cost on that page. A 200px margin
 * still has the map in place by the time the visitor reaches it.
 *
 * The box itself renders immediately (pass its size through `className`), so
 * nothing moves when the content arrives.
 */
export function NearViewport({
  children,
  className,
  rootMargin = "200px",
}: {
  children: React.ReactNode;
  className?: string;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [near, rootMargin]);

  return (
    <div ref={ref} className={className}>
      {near ? children : null}
    </div>
  );
}
