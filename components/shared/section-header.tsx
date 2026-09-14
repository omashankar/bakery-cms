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

  return (
    <div
      className={cn(
        "mb-10 space-y-3",
        align === "center" && "mx-auto max-w-2xl text-center",
        className
      )}
    >
      {hasOverline && (
        <p className="text-xs font-semibold uppercase tracking-widest text-bakery-700">
          {overline}
        </p>
      )}
      {hasTitle && (
        <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h2>
      )}
      {hasDescription && (
        <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}
