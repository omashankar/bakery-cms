import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "default" | "lg";

const base =
  "group inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-[#D4A373] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF9F7] disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground shadow-sm hover:-translate-y-0.5 hover:bg-[#6a4325] hover:shadow-md",
  secondary:
    "border border-border bg-card text-foreground shadow-sm hover:-translate-y-0.5 hover:border-[#D4A373] hover:bg-[#FBF6EF] hover:shadow-md",
  ghost: "text-foreground hover:bg-[#F1EBE3]",
};

const sizes: Record<Size, string> = {
  default: "h-11 px-5 text-sm",
  lg: "h-12 px-7 text-[15px]",
};

export interface LinkButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  "aria-label"?: string;
}

/** Marketing CTA — a Link styled as a pill button, tuned for the landing page. */
export function LinkButton({
  href,
  children,
  variant = "primary",
  size = "default",
  className,
  ...rest
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {children}
    </Link>
  );
}
