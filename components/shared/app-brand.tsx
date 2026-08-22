import Link from "next/link";
import { AppBrandImage } from "@/components/shared/app-brand-image";
import { cn } from "@/lib/utils";

/**
 * The identity this install ships with: the CMS product itself.
 *
 * It is the DEFAULT, not the only answer. The two surfaces that belong to the
 * vendor — the platform page and the design system — are about the product and
 * keep it. The admin sidebar is a shop owner's own control panel and passes its
 * own name instead; see `AppBrand`.
 */
const PRODUCT_NAME = "Bakery CMS";
const PRODUCT_LETTER = "B";

interface AppBrandMarkProps {
  /** sm = admin sidebar; md = design-system / hub headers */
  size?: "sm" | "md";
  /** The badge letter. Defaults to the product's. */
  letter?: string;
  /**
   * A square picture to fill the badge with — the shop's favicon.
   *
   * The favicon is the one image a shop already has that is guaranteed square,
   * which is why it fits here and the wordmark logo does not: a 3:1 wordmark in
   * a 32px box is 32×10 and unreadable. Empty falls back to the letter.
   */
  image?: string;
  /** Titles the picture. Ignored when there is no image. */
  name?: string;
  className?: string;
}

/** The square badge on its own. Theme-aware via primary tokens. */
export function AppBrandMark({
  size = "md",
  letter = PRODUCT_LETTER,
  image,
  name = PRODUCT_NAME,
  className,
}: AppBrandMarkProps) {
  const hasImage = Boolean(image?.trim());

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center shadow-sm",
        size === "sm" ? "size-8 rounded-lg" : "size-9 rounded-xl",
        // A picture fills the badge the way an app icon does; the primary fill
        // is the letter's backdrop and would show through a transparent PNG.
        hasImage ? "overflow-hidden" : "bg-primary",
        className
      )}
      aria-hidden
    >
      {hasImage ? (
        <AppBrandImage src={image!.trim()} letter={letter} name={name} />
      ) : (
        <span className="font-heading text-sm font-bold text-primary-foreground">
          {letter}
        </span>
      )}
    </div>
  );
}

interface AppBrandProps {
  subtitle: string;
  /**
   * Whose name this is. Defaults to the product's.
   *
   * This used to be the string "Bakery CMS", written into the component. That
   * put the vendor's name inside every client's admin panel — and this CMS runs
   * ten business types, so nine of them read a word for a trade they are not in.
   */
  name?: string;
  /** The badge letter. Defaults to the product's, then to the name's initial. */
  letter?: string;
  /** A square picture for the badge — the shop's favicon. Falls back to the letter. */
  image?: string;
  /**
   * The name has not loaded yet, so render a placeholder rather than a value
   * that is about to change. The settings store answers from the shipped seed
   * until the server's copy lands, so a caller reading a shop's own name would
   * otherwise show the seed for a frame and then swap.
   */
  pending?: boolean;
  href?: string;
  size?: "sm" | "md";
  collapsed?: boolean;
  className?: string;
  onNavigate?: () => void;
}

/** Wordmark + mark used in the admin sidebar and the vendor-facing chrome. */
export function AppBrand({
  subtitle,
  name = PRODUCT_NAME,
  letter,
  image,
  pending = false,
  href,
  size = "md",
  collapsed = false,
  className,
  onNavigate,
}: AppBrandProps) {
  const badgeLetter =
    letter?.trim() || name.trim().charAt(0).toUpperCase() || PRODUCT_LETTER;

  const content = (
    <>
      <AppBrandMark
        size={size}
        letter={pending ? PRODUCT_LETTER : badgeLetter}
        // Nothing until the shop's own settings have landed: the seed carries
        // no favicon, so drawing one before then would be the product's mark
        // pretending to be the shop's.
        image={pending ? undefined : image}
        name={name}
      />
      {!collapsed ? (
        <div className="min-w-0 flex-1">
          {pending ? (
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
          ) : (
            <p className="truncate font-heading text-sm font-bold leading-tight text-foreground">
              {name}
            </p>
          )}
          <p
            className={cn(
              "truncate text-muted-foreground",
              size === "sm" ? "text-[11px]" : "text-xs"
            )}
          >
            {subtitle}
          </p>
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          "flex items-center transition-premium hover:opacity-90",
          collapsed ? "justify-center" : "gap-3",
          className
        )}
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-0 items-center",
        collapsed ? "justify-center" : "gap-3",
        className
      )}
    >
      {content}
    </div>
  );
}
