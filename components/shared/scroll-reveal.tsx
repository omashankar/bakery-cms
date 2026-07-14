"use client";

import { Children, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

function useInViewOnce<T extends Element>(rootMargin = "0px 0px -10% 0px") {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, shown };
}

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  /** Extra delay (ms) before the reveal transition runs. */
  delay?: number;
}

/**
 * Reveals its content with a fade-up the first time it scrolls into view.
 * CSS-driven (IntersectionObserver + transition) so it always settles visible
 * and honours reduced-motion — no JS animation library that can leave content hidden.
 */
export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  const { ref, shown } = useInViewOnce<HTMLDivElement>();

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn(
        "transition-all duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0",
        className
      )}
    >
      {children}
    </div>
  );
}

interface StaggerRevealProps {
  children: React.ReactNode;
  className?: string;
  /** ms between each child's reveal. */
  step?: number;
}

/**
 * Reveals each direct child with a cascading fade-up when the group scrolls into
 * view. Wrap a grid: pass the grid classes as `className`; each item is wrapped in
 * a full-height cell so equal-height cards keep aligning.
 */
export function StaggerReveal({ children, className, step = 70 }: StaggerRevealProps) {
  const { ref, shown } = useInViewOnce<HTMLDivElement>();

  return (
    <div ref={ref} className={className}>
      {Children.map(children, (child, index) => (
        <div
          style={{ transitionDelay: shown ? `${index * step}ms` : "0ms" }}
          className={cn(
            "h-full transition-all duration-[650ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:!translate-y-0 motion-reduce:!opacity-100 motion-reduce:transition-none",
            shown ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
          )}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
