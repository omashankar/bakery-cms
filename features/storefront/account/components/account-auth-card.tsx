import { cn } from "@/lib/utils";

interface AccountAuthCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
}

export function AccountAuthCard({
  title,
  description,
  children,
  className,
  footer,
}: AccountAuthCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-white p-6 shadow-sm sm:p-8",
        className
      )}
    >
      <div className="mb-6 space-y-2">
        <h2 className="font-heading text-xl font-semibold">{title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
      {footer ? <div className="mt-6 border-t border-border pt-6">{footer}</div> : null}
    </div>
  );
}
