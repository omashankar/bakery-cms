/**
 * THE BAR ABOVE THE LOGO: TODAY'S DEADLINE, THE SHOP'S WHATSAPP, IN THE
 * PAGE'S OWN COLUMN.
 *
 * Asked for together (2026-11-02): the bar's words lined up with the logo on a
 * wide screen, a same-day deadline a customer can act on, WhatsApp beside the
 * phone. (Words under the header's icons were tried the same day and the
 * shop said no — the icons stand alone.)
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("server-only", () => ({}));

import { sameDayWindow } from "@/apps/website/lib/storefront-trust.server";
import { countdownParts } from "@/features/orders/lib/delivery-date";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

afterEach(() => vi.useRealTimers());

describe("today's same-day window", () => {
  it("is open before the cutoff, with the time left", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T06:30:00Z")); // 12:00 in Kolkata
    const today = sameDayWindow({ sameDayCutoff: "14:00", deliveryLeadDays: 0 }, "Asia/Kolkata");
    expect(today.closesAt).toBe("14:00");
    expect(countdownParts(today.timeLeft)?.spoken).toBe("2 hours 0 minutes left");
  });

  it("has nothing to say after the cutoff", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T10:30:00Z")); // 16:00 in Kolkata
    expect(sameDayWindow({ sameDayCutoff: "14:00", deliveryLeadDays: 0 }, "Asia/Kolkata").timeLeft).toBeNull();
  });

  it("does not exist for a shop that cannot deliver today", () => {
    expect(sameDayWindow({ sameDayCutoff: "14:00", deliveryLeadDays: 1 }, "Asia/Kolkata").closesAt).toBe("");
    expect(sameDayWindow({ sameDayCutoff: "", deliveryLeadDays: 0 }, "Asia/Kolkata").closesAt).toBe("");
  });
});

describe("the bar", () => {
  const bar = read("apps/website/components/storefront-info-bar.tsx");
  const chrome = read("apps/website/lib/storefront-chrome.server.ts");

  it("sets its words in the page's column, not the window's edges", () => {
    expect(bar).toContain("layoutSpacing.container");
    expect(bar).not.toContain("flex h-9 w-full items-center");
  });

  it("takes WhatsApp from the shop's own social link, never from the phone", () => {
    expect(chrome).toMatch(/platform\?\.toLowerCase\(\) === "whatsapp" && isSafeSocialUrl/);
    expect(bar).not.toMatch(/wa\.me/);
  });

  it("adds them only to a bar the shop switched on", () => {
    expect(chrome).toContain("return bar ? { ...bar, ...extras } : null;");
  });

  it("leaves no stray divider once the deadline has closed", () => {
    // The divider after the deadline belongs to the deadline, so it goes with it;
    // the shop's first line is never given one of its own.
    const line = read("apps/website/components/info-bar-same-day.tsx");
    expect(line).toContain("if (!parts) return null;");
    expect(line).toContain('className="hidden h-3.5 w-px bg-white/40 sm:block"');
    expect(bar).toContain("{index > 0 ? <span aria-hidden=\"true\" className=\"h-3.5 w-px bg-white/40\" /> : null}");
  });

  it("states the deadline to the minute, and never louder as it closes", () => {
    const line = read("apps/website/components/info-bar-same-day.tsx");
    expect(line).not.toMatch(/parts\.seconds|text-red|destructive|animate-/);
  });
});
