import type { SectionAlign } from "@/types/homepage-builder";
import { cn } from "@/lib/utils";
import { storefrontHeading } from "@/constants/typography";

interface SectionHeaderProps {
  overline?: string;
  title: string;
  description?: string;
  align?: SectionAlign;
  className?: string;
}

/**
 * WILL THIS HEADING DRAW ANYTHING?
 *
 * Asked by every band that puts a top margin on whatever follows the
 * heading. That margin exists to sit against the heading's own `mb-6`, and
 * with a blank heading it has nothing to sit against — so it becomes 24px
 * of air at the top of a band that has none at the foot. Four bands on this
 * shop's page are in exactly that state; measured at 1440, 48px above and
 * 24px below.
 *
 * Exported from here rather than written out at each band, because the rule
 * for what counts as a heading lives in the component below and the two
 * drifting apart is the whole fault in a subtler form.
 */
export function sectionHeaderDraws(
  overline?: string,
  title?: string,
  description?: string,
): boolean {
  return Boolean(overline?.trim() || title?.trim() || description?.trim());
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

  // The same question the bands below ask before they hold a gap open for
  // this heading. Asked here so the two cannot disagree.
  if (!sectionHeaderDraws(overline, title, description)) return null;

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
        /*
          CENTRE CLAMPS AND RIGHT DOES NOT, which is deliberate rather than
          an oversight. `max-w-2xl` is there so a centred line does not run
          the full width of a 1440px band and stop reading as a heading; a
          right-aligned one is already anchored to an edge and a clamp would
          only pull it off that edge.

          Neither class moves anything on its own when this header is a flex
          child that hugs its text — which is where most of the headings on
          this page live. `SectionHeadingRow` is what gives them the room.
        */
        align === "center" && "mx-auto max-w-2xl text-center",
        align === "right" && "text-right",
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
        <h2 className={cn(storefrontHeading.row, "text-foreground")}>
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
