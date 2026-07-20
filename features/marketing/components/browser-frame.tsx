import { LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrowserFrameProps {
  url?: string;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

/**
 * A soft browser-chrome wrapper used to frame product illustrations.
 * Pure CSS — no external images.
 */
export function BrowserFrame({
  url = "app.bakerycms.com/admin",
  children,
  className,
  bodyClassName,
}: BrowserFrameProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-24px_rgba(74,51,36,0.28)]",
        className
      )}
    >
      {/* Chrome */}
      <div className="flex items-center gap-3 border-b border-border bg-[#FBFAF8] px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#E7B7A6]" />
          <span className="size-2.5 rounded-full bg-[#EBD4A0]" />
          <span className="size-2.5 rounded-full bg-[#BFD8B4]" />
        </div>
        <div className="mx-auto flex w-full max-w-xs items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground">
          <LockIcon className="size-3 text-[#B0895F]" />
          <span className="truncate">{url}</span>
        </div>
        <div className="hidden w-8 sm:block" />
      </div>
      {/* Body */}
      <div className={cn("bg-card", bodyClassName)}>{children}</div>
    </div>
  );
}
