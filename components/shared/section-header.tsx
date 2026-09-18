import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  overline?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
}

export function SectionHeader({
  overline,
  title,
  description,
  align = "center",
  className,
}: SectionHeaderProps) {
  /**
   * A HEADING NOBODY WROTE TAKES NO ROOM.
   *
   * `title` was rendered unguarded, so a blank one drew an empty <h2> at
   * 36px with a 40px margin under it — a heading-shaped hole above the band
   * it was supposed to introduce. Not hypothetical and not new: four section
   * types ship `title: ""` on purpose (tabbed-rail, promo-collage, tile-grid,
   * category-rail), and every one of them has been drawing that hole.
   *
   * Trimmed, because a space is not a heading either — and a stored value
   * that looks empty in the builder was the likeliest way to get one.
   */
  const hasOverline = Boolean(overline?.trim());
  const hasTitle = Boolean(title?.trim());
  const hasDescription = Boolean(description?.trim());

  if (!hasOverline && !hasTitle && !hasDescription) return null;

  /*
    SIZED FOR A ROW, not for the top of a page.

    This was a 36/40px title with a 12px stack and 40px under it — about
    150px of heading over every row of four products, on a page with twenty
    rows. The storefront this is drawn from gives the same job about 70px: a
    title a little larger than the product names under it, one quiet line
    beneath, and the row starting straight after.
  */
  return (
    <div
      className={cn(
        "mb-6 space-y-1.5",
        align === "center" && "mx-auto max-w-2xl text-center",
        className
      )}
    >
      {hasOverline && (
        <p className="text-[11px] font-semibold uppercase tracking-widest text-bakery-700">
          {overline}
        </p>
      )}
      {/*
        A STEP BIGGER AT THE TOP OF THE SCALE, and only there.

        Measured against the layout this is drawn from: its row heading sits
        at about 32px in a 1520px column, and ours was 24px in 1376 — the
        same heading about a quarter smaller for the space it has.

        28px from `sm`, and 24 below it. It went to 30 first and the shop
        said that was a step too far — which is the same pull the note above
        records: this heading sits over a row on a page of twenty of them,
        not at the top of a page of its own, so the reference's 32 is an
        upper bound rather than a target.

        Phone stays at 24 because at 390px a 28px title wraps for half the
        rows here, and two lines of heading over every row is the 150px the
        note was written about.
      */}
      {hasTitle && (
        <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem] sm:leading-tight">
          {title}
        </h2>
      )}
      {hasDescription && (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
