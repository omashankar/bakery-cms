import {
  EyeIcon,
  GripVerticalIcon,
  RocketIcon,
  SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const blocks = [
  { label: "Hero Banner", selected: true },
  { label: "Featured Cakes", selected: false },
  { label: "Best Sellers", selected: false },
  { label: "Testimonials", selected: false },
  { label: "Newsletter", selected: false },
];

/** Homepage builder canvas illustration — draggable, toggleable sections. */
export function BuilderMockup({ className }: { className?: string }) {
  return (
    <div className={cn("bg-[#FCFBF9] p-4 sm:p-5", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-semibold text-foreground">Homepage Builder</p>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground">
            <EyeIcon className="size-3" /> Preview
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground">
            <RocketIcon className="size-3" /> Publish
          </span>
        </div>
      </div>

      {/* Section list */}
      <div className="mt-4 flex flex-col gap-2.5">
        {blocks.map((b) => (
          <div
            key={b.label}
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors",
              b.selected
                ? "border-[#D4A373] ring-2 ring-[#D4A373]/25"
                : "border-border"
            )}
          >
            <GripVerticalIcon className="size-4 shrink-0 text-[#C4B29B]" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-foreground">{b.label}</p>
              <div className="mt-1.5 flex gap-1">
                <span className="h-1.5 w-16 rounded-full bg-[#EDE6DC]" />
                <span className="h-1.5 w-10 rounded-full bg-[#EDE6DC]" />
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex size-6 items-center justify-center rounded-md text-muted-foreground">
                <SettingsIcon className="size-3.5" />
              </span>
              {/* toggle */}
              <span
                className={cn(
                  "flex h-4 w-7 items-center rounded-full p-0.5",
                  b.label === "Newsletter" ? "justify-start bg-[#E4DDD2]" : "justify-end bg-[#7A4D2B]"
                )}
              >
                <span className="size-3 rounded-full bg-white shadow-sm" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
