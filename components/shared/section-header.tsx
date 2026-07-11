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
  return (
    <div
      className={cn(
        "mb-10 space-y-3",
        align === "center" && "mx-auto max-w-2xl text-center",
        className
      )}
    >
      {overline && (
        <p className="text-xs font-semibold uppercase tracking-widest text-bakery-700">
          {overline}
        </p>
      )}
      <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}
