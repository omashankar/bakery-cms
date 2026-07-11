import { cn } from "@/lib/utils";
import { typographyPresets } from "@/constants/typography";

interface DesignSectionProps {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

/** Page section: consistent title, description, and 24px content gap. */
export function DesignSection({
  id,
  title,
  description,
  children,
  className,
}: DesignSectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-28 space-y-6", className)}>
      <header className="space-y-2">
        <h2 className={cn(typographyPresets.h3, "text-foreground")}>{title}</h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}

/** Uppercase subsection label — same rhythm everywhere on the design-system page. */
export function DemoLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "mb-3 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase",
        className
      )}
    >
      {children}
    </p>
  );
}

/** Soft info / note panel readable in light and dark. */
export function DemoNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground sm:p-5",
        className
      )}
    >
      {children}
    </div>
  );
}
