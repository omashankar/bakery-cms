import { HeartIcon, StarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TAG_CLASS =
  "rounded-full border border-border bg-[#FBFAF8] px-2 py-0.5 text-[9px] font-semibold text-[#8a6a45] shadow-sm";

/** Floating corner label — used on the centered hero panel. */
function BlockTag({ children }: { children: React.ReactNode }) {
  return <span className={cn("absolute left-4 top-4 z-10", TAG_CLASS)}>{children}</span>;
}

/** Inline block label — flows above the block content, so it always aligns
 * with the content's left edge and keeps a consistent gap below. */
function BlockLabel({ children }: { children: React.ReactNode }) {
  return <span className={cn("inline-flex w-fit", TAG_CLASS)}>{children}</span>;
}

/** Wedding builder page preview — CMS-controlled blocks. Pure CSS. */
export function WeddingMockup({ className }: { className?: string }) {
  return (
    <div className={cn("@container flex flex-col gap-3 bg-[#FCFBF9] p-4 sm:p-5", className)}>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-[#F6ECDF] p-6 text-center">
        <BlockTag>Hero</BlockTag>
        <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <HeartIcon className="size-4" />
        </span>
        <p className="mt-3 font-heading text-[17px] font-semibold text-foreground">
          Timeless Wedding Cakes
        </p>
        <p className="mx-auto mt-1 max-w-[220px] text-[10px] text-muted-foreground">
          Handcrafted centerpieces for your most important day.
        </p>
        <span className="mt-3 inline-flex rounded-full bg-primary px-3 py-1 text-[10px] font-medium text-primary-foreground">
          Book a tasting
        </span>
      </div>

      {/* Collections */}
      <div className="rounded-xl border border-border bg-card p-4">
        <BlockLabel>Collections</BlockLabel>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {["Classic", "Floral", "Modern"].map((c) => (
            <div key={c} className="overflow-hidden rounded-lg border border-border">
              <div className="h-12 bg-[#EADBC7]" />
              <p className="px-2 py-1.5 text-[10px] font-medium text-foreground">{c}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Testimonials + Inquiry */}
      <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <BlockLabel>Testimonials</BlockLabel>
          <div className="mt-3 flex gap-0.5 text-[#D4A373]">
            {Array.from({ length: 5 }).map((_, i) => (
              <StarIcon key={i} className="size-3 fill-current" />
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            &ldquo;Absolutely stunning — every guest asked where our cake was from.&rdquo;
          </p>
          <p className="mt-1.5 text-[10px] font-semibold text-foreground">— Priya &amp; Arjun</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <BlockLabel>Inquiry</BlockLabel>
          <div className="mt-3 flex flex-col gap-1.5">
            <span className="h-6 rounded-md border border-border bg-[#FBFAF8]" />
            <span className="h-6 rounded-md border border-border bg-[#FBFAF8]" />
            <span className="mt-0.5 inline-flex h-6 items-center justify-center rounded-md bg-primary text-[10px] font-medium text-primary-foreground">
              Send inquiry
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
