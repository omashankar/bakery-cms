"use client";

import { useState } from "react";
import { ArrowLeft, CalendarDays, Pencil, X } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addDays, isPastTimeSlot, todayAsDateString } from "@/features/orders/lib/delivery-date";
import type { DeliverySlot } from "@/features/orders/lib/checkout-draft";
import { cn } from "@/lib/utils";
import type { DeliveryTier } from "@/types/settings";
import { formatCalendarDate, formatCurrency } from "@/utils/format";

/** How many days the date step offers as one-tap choices. */
const QUICK_DAYS = 7;

type Stage = "date" | "type" | "time";

/**
 * ONE FIELD, ONE DIALOG — the reference's "Delivery Date and Time": a day,
 * then the kind of delivery with its price (Standard free, Fixed time,
 * Midnight…), then the window. It replaces a native date input, a speed list
 * and a dropdown laid side by side, three controls that had to be filled in an
 * order nothing on screen stated.
 *
 * The rules are the page's, handed in, not re-derived: `earliestDate` already
 * carries the lead time, the zone's floor and today's cutoff, and the windows
 * are the chosen tier's own — a tier with none takes no window at all. A shop
 * with no tiers skips the type step and books the shop-wide windows, exactly
 * as before.
 */
export function DeliverySlotPicker({
  id,
  slot,
  tiers,
  defaultWindows,
  earliestDate,
  invalid,
  onChange,
}: {
  /** On the trigger, so a refused Continue can focus it by id. */
  id: string;
  slot: DeliverySlot;
  tiers: DeliveryTier[];
  defaultWindows: string[];
  earliestDate: string;
  invalid?: boolean;
  onChange: (next: { date: string; timeSlot: string; tierId: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("date");
  const [date, setDate] = useState(slot.date);
  const [tierId, setTierId] = useState(slot.tierId ?? "");

  const tier = tiers.find((entry) => entry.id === tierId);
  const windows = (tiers.length > 0 ? (tier?.windows ?? []) : defaultWindows).filter(
    // Today's windows that have closed are not offered — the quote refuses them.
    (window) => !isPastTimeSlot(date, window),
  );
  const chosenTier = tiers.find((entry) => entry.id === slot.tierId);

  const today = todayAsDateString();
  const quickDays = Array.from({ length: QUICK_DAYS }, (_, index) => addDays(earliestDate, index));
  const dayName = (day: string) =>
    day === today ? "Today" : day === addDays(today, 1) ? "Tomorrow" : formatCalendarDate(day, { weekday: "short" });

  function begin() {
    setDate(slot.date && slot.date >= earliestDate ? slot.date : "");
    setTierId(slot.tierId ?? "");
    setStage("date");
    setOpen(true);
  }

  function finish(timeSlot: string, chosenTierId = tierId) {
    onChange({ date, timeSlot, tierId: chosenTierId });
    setOpen(false);
  }

  function pickDate(day: string) {
    setDate(day);
    setStage(tiers.length > 0 ? "type" : "time");
  }

  function pickTier(next: DeliveryTier) {
    setTierId(next.id);
    // A midnight or next-day service has nothing to choose: done.
    if (next.windows.length === 0) finish("", next.id);
    else setStage("time");
  }

  const title =
    stage === "date" ? "Choose a delivery date" : stage === "type" ? "Choose delivery type" : "Choose a time";

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={begin}
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5 sm:max-w-md text-left transition-colors hover:border-bakery-700 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          slot.date ? "border-green-600" : "border-input",
          invalid && !slot.date && "border-destructive",
        )}
      >
        {slot.date ? (
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">
              {formatCalendarDate(slot.date, { day: "numeric", month: "short", year: "numeric" })}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {[chosenTier?.label ?? (tiers.length > 0 ? "" : "Standard delivery"), slot.timeSlot]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Select delivery date &amp; time</span>
        )}
        {slot.date ? (
          <Pencil className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <CalendarDays className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false} className="max-h-[85vh] gap-0 overflow-y-auto p-0 sm:max-w-md">
          {/* A band in the shop's colour, back and close in it — the reference's header. */}
          <DialogHeader className="sticky top-0 z-10 gap-0.5 bg-bakery-700 px-4 py-3 text-white">
            <DialogTitle className="flex items-center gap-2 pr-8 text-white">
              {stage !== "date" ? (
                <button
                  type="button"
                  onClick={() => setStage(stage === "time" && tiers.length > 0 ? "type" : "date")}
                  aria-label="Back"
                  className="-ml-1 rounded p-1 text-white/80 hover:text-white"
                >
                  <ArrowLeft className="size-5" />
                </button>
              ) : null}
              {title}
            </DialogTitle>
            <DialogClose
              aria-label="Close"
              className="absolute top-3 right-3 rounded p-1 text-white/80 hover:text-white"
            >
              <X className="size-5" />
            </DialogClose>
            {date && stage !== "date" ? (
              <DialogDescription className="text-white/80">
                {formatCalendarDate(date, { weekday: "long", day: "numeric", month: "long" })}
              </DialogDescription>
            ) : (
              <DialogDescription className="text-white/80">The earliest day depends on preparation time.</DialogDescription>
            )}
          </DialogHeader>

          <div className="p-4">
          {stage === "date" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {quickDays.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => pickDate(day)}
                    className={cn(
                      "flex flex-col items-center rounded-lg border px-2 py-2.5 text-center transition-colors hover:border-bakery-700",
                      day === date ? "border-bakery-700 bg-bakery-50" : "border-border",
                    )}
                  >
                    <span className="text-xs text-muted-foreground">{dayName(day)}</span>
                    <span className="text-base font-semibold">
                      {formatCalendarDate(day, { day: "numeric" })}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatCalendarDate(day, { month: "short" })}
                    </span>
                  </button>
                ))}
              </div>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Or pick a later date</span>
                <input
                  type="date"
                  aria-label="Delivery date"
                  min={earliestDate}
                  value={date}
                  onChange={(event) => event.target.value && pickDate(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                />
              </label>
            </div>
          ) : null}

          {stage === "type" ? (
            <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
              {tiers.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => pickTier(entry)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-cream-50",
                      entry.id === tierId && "bg-bakery-50",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{entry.label}</span>
                      {entry.description ? (
                        <span className="block text-xs text-muted-foreground">{entry.description}</span>
                      ) : null}
                    </span>
                    {/* Free says Free, the way the Delivery row does. */}
                    <span
                      className={cn(
                        "shrink-0 text-sm font-semibold",
                        entry.fee > 0 ? "text-foreground" : "text-green-700",
                      )}
                    >
                      {entry.fee > 0 ? formatCurrency(entry.fee) : "FREE"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {stage === "time" ? (
            windows.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2" aria-label="Delivery time">
                {windows.map((window) => (
                  <li key={window}>
                    <button
                      type="button"
                      onClick={() => finish(window)}
                      className={cn(
                        "w-full rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors hover:border-bakery-700",
                        window === slot.timeSlot && date === slot.date
                          ? "border-bakery-700 bg-bakery-50"
                          : "border-border",
                      )}
                    >
                      {window}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
                Every window for this day has closed. Go back and choose another day.
              </p>
            )
          ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
