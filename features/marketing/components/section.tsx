import { cn } from "@/lib/utils";

export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}

export function Section({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 py-20 md:py-28", className)}>
      {children}
    </section>
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold tracking-wide text-[#8a6a45] shadow-sm",
        className
      )}
    >
      <span className="size-1.5 rounded-full bg-[#D4A373]" />
      {children}
    </span>
  );
}

interface SectionHeadingProps {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className
      )}
    >
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="max-w-3xl text-balance text-3xl font-semibold tracking-tight md:text-[2.6rem] md:leading-[1.1]">
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground md:text-lg",
            align === "center" ? "mx-auto" : ""
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
