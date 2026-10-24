import type { ComponentProps } from "react";
import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A form box with its meaning drawn in front of it — a person for the name, a
 * pin for the PIN — so the account forms scan as fields of different kinds
 * rather than rows of identical white bars. Shared by the profile and the
 * address book, so the two forms cannot drift apart.
 */
export function IconInput({
  icon: Icon,
  className,
  ...props
}: ComponentProps<typeof Input> & { icon: LucideIcon }) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input className={cn("h-11 pl-10", className)} {...props} />
    </div>
  );
}
