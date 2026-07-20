import { ArrowUpRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const revenuePoints = [28, 34, 30, 42, 46, 40, 54, 60, 56, 70, 66, 82];

const miniStats = [
  { label: "Orders", value: "1,284" },
  { label: "Visitors", value: "48.2k" },
  { label: "Conversion", value: "4.8%" },
];

const topProducts = [
  { name: "Velvet Truffle", pct: 82 },
  { name: "Red Velvet", pct: 64 },
  { name: "Blueberry Cheesecake", pct: 48 },
  { name: "Classic Tiramisu", pct: 36 },
];

function buildPath(values: number[], w: number, h: number, close: boolean) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return [x, y] as const;
  });
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return close ? `${line} L${w},${h} L0,${h} Z` : line;
}

const CHART_W = 320;
const CHART_H = 96;
const RETURNING = 68;
const CIRC = 2 * Math.PI * 26;

/** Reports & analytics preview. Pure CSS + inline SVG (no gradients, no libraries). */
export function AnalyticsMockup({ className }: { className?: string }) {
  return (
    <div className={cn("@container bg-[#FCFBF9] p-4 sm:p-5", className)}>
      <div className="grid grid-cols-1 gap-3 @lg:grid-cols-3">
        {/* Revenue + mini stats */}
        <div className="flex flex-col gap-3 @lg:col-span-2">
          <div className="grid grid-cols-3 gap-2.5">
            {miniStats.map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {s.label}
                </p>
                <p className="mt-1 font-heading text-[16px] font-semibold leading-none">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-1 flex-col rounded-xl border border-border bg-card p-4">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Revenue
                </p>
                <p className="mt-1 font-heading text-[22px] font-semibold leading-none">₹4,82,600</p>
              </div>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-[#E9F1E4] px-2 py-0.5 text-[10px] font-semibold text-[#4f8a45]">
                <ArrowUpRightIcon className="size-2.5" /> +18.6%
              </span>
            </div>
            <svg
              viewBox={`0 0 ${CHART_W} ${CHART_H}`}
              className="mt-3 h-24 w-full"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path d={buildPath(revenuePoints, CHART_W, CHART_H, true)} fill="#7A4D2B" fillOpacity="0.07" />
              <path
                d={buildPath(revenuePoints, CHART_W, CHART_H, false)}
                fill="none"
                stroke="#7A4D2B"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Top products + returning */}
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[12px] font-semibold">Top products</p>
            <div className="mt-3 flex flex-col gap-2.5">
              {topProducts.map((p) => (
                <div key={p.name}>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-medium text-foreground">{p.name}</span>
                    <span className="text-muted-foreground">{p.pct}%</span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#EDE6DC]">
                    <div className="h-full rounded-full bg-[#D4A373]" style={{ width: `${p.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden>
              <circle cx="32" cy="32" r="26" fill="none" stroke="#EDE6DC" strokeWidth="8" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="#7A4D2B"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(RETURNING / 100) * CIRC} ${CIRC}`}
              />
            </svg>
            <div>
              <p className="font-heading text-[20px] font-semibold leading-none">{RETURNING}%</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Returning customers</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
