import { Children } from "react";

/**
 * NO LONGER REVEALS ANYTHING, and that is the point.
 *
 * Both of these faded their content up as it scrolled into view — an
 * IntersectionObserver per wrapper, a 650-800ms transition, and a stagger
 * between the cards in a grid. The shop asked for the design without the
 * motion, so they draw their children and nothing else.
 *
 * KEPT AS COMPONENTS rather than deleted, for two reasons. About eighty call
 * sites across the storefront pass grid classes to them, and `StaggerReveal`'s
 * per-child `h-full` wrapper is load-bearing: it is what makes equal-height
 * cards line up inside a grid. Removing the components would mean editing
 * every one of those call sites and re-deriving that wrapper at each.
 *
 * They are plain markup now — no client boundary, no observer, no state. That
 * also fixes something that had nothing to do with looks: a full-page
 * screenshot caught bands mid-reveal and photographed them blank.
 */

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  /** Accepted and ignored — it was the reveal's delay. */
  delay?: number;
}

export function ScrollReveal({ children, className }: ScrollRevealProps) {
  return <div className={className}>{children}</div>;
}

interface StaggerRevealProps {
  children: React.ReactNode;
  className?: string;
  /** Accepted and ignored — it was the gap between each child's reveal. */
  step?: number;
}

export function StaggerReveal({ children, className }: StaggerRevealProps) {
  return (
    <div className={className}>
      {Children.map(children, (child) => (
        <div className="h-full">{child}</div>
      ))}
    </div>
  );
}
