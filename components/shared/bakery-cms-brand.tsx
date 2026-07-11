import Link from "next/link";
import { cn } from "@/lib/utils";

interface BakeryCmsMarkProps {
  /** sm = admin sidebar; md = design-system / hub headers */
  size?: "sm" | "md";
  className?: string;
}

/** Product mark for Bakery CMS (admin / design-system). Theme-aware via primary tokens. */
export function BakeryCmsMark({ size = "md", className }: BakeryCmsMarkProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center bg-primary shadow-sm",
        size === "sm" ? "size-8 rounded-lg" : "size-9 rounded-xl",
        className
      )}
      aria-hidden
    >
      <span className="font-heading text-sm font-bold text-primary-foreground">B</span>
    </div>
  );
}

interface BakeryCmsBrandProps {
  subtitle: string;
  href?: string;
  size?: "sm" | "md";
  collapsed?: boolean;
  className?: string;
  onNavigate?: () => void;
}

/** Wordmark + mark used in admin sidebar and design-system chrome. */
export function BakeryCmsBrand({
  subtitle,
  href,
  size = "md",
  collapsed = false,
  className,
  onNavigate,
}: BakeryCmsBrandProps) {
  const content = (
    <>
      <BakeryCmsMark size={size} />
      {!collapsed ? (
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-bold leading-tight text-foreground">
            Bakery CMS
          </p>
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
