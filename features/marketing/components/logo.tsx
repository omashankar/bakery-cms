import Link from "next/link";
import { CroissantIcon } from "lucide-react";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  /** Muted wordmark for use on the footer / dark-ish surfaces. */
  tone?: "default" | "invert";
}

/** Bakery CMS product wordmark for the marketing site. */
export function Logo({ className, tone = "default" }: LogoProps) {
  return (
    <Link
      /*
        `/` is the SHOP now — it 307s to /store. So the product wordmark, in
        both the header and the footer of the marketing site, sent anyone who
        clicked it to a bakery instead of back to the page they were reading.
      */
      href={routes.platform.home}
      aria-label="Bakery CMS home"
      className={cn("group inline-flex items-center gap-2.5", className)}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 group-hover:-rotate-6",
          tone === "invert" ? "bg-[#D4A373] text-[#3a2413]" : "bg-primary text-primary-foreground"
        )}
      >
        <CroissantIcon className="size-5" />
      </span>
      <span className="font-heading text-[17px] font-bold tracking-tight">
        <span className={tone === "invert" ? "text-white" : "text-foreground"}>Bakery</span>{" "}
        <span className="text-[#B0895F]">CMS</span>
      </span>
    </Link>
  );
}
