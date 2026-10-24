import { cn } from "@/lib/utils";

interface AuthCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

/** Form surface for staff auth — interaction card, soft border, no heavy chrome. */
export function AuthCard({
  title,
  description,
  children,
  className,
  footer,
}: AuthCardProps) {
  return (
    <section className={cn("space-y-8", className)}>
      <header className="space-y-2">
        {/* The page heading on every auth screen: the brand panel beside it is hidden on a phone. */}
        <h1 className="font-heading text-[2rem] leading-tight font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{description}</p>
      </header>

      <div className="rounded-2xl border border-border/70 bg-card p-6 shadow-[0_1px_2px_rgb(45_31_22/0.04),0_20px_48px_-20px_rgb(45_31_22/0.22)] sm:p-8">
        <div className="space-y-5">{children}</div>
      </div>

      {footer ? <div>{footer}</div> : null}
    </section>
  );
}
