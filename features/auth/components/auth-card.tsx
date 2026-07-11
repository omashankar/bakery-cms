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
        <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{description}</p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="space-y-5">{children}</div>
      </div>

      {footer ? <div>{footer}</div> : null}
    </section>
  );
}
