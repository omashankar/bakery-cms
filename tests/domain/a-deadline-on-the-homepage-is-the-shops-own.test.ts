import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { countdownParts, shopClockNow, timeLeftToday } from "@/features/orders/lib/delivery-date";
import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";

/**
 * A COUNTDOWN ON THE HOMEPAGE IS THE SHOP'S OWN DEADLINE, OR THERE IS NONE.
 *
 * The band's shape came from a competitor's strip. Its number did not: it is
 * `commerce.sameDayCutoff`, the field checkout already refuses an order
 * against. This file guards the two things that make that true — the digits
 * come from the stored cutoff, and the band draws nothing when they cannot.
 *
 * The pure rules that decide whether there is a deadline at all live in
 * a-countdown-is-only-shown-when-there-is-one.test.ts, beside the arithmetic.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * The source with its prose taken out.
 *
 * Every case below asks what the component DOES. The band's own comments say
 * why `getCommerceSettings` is the wrong source, that there is no
 * `aria-live` anywhere, and that `--cream-50` is literally #ffffff — so
 * without this, three of these guards go red on the explanation of the very
 * rule they are checking is kept.
 */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

/**
 * ONE FUNCTION'S BODY, not the file.
 *
 * A file-wide `includes` over 3,400 lines passes for the very regression it
 * names — `!headline` alone appears a dozen times in here.
 */
const bodyOf = (source: string, signature: string) => {
  const at = source.indexOf(signature);
  expect(at, `${signature} is gone`).toBeGreaterThan(-1);
  const rest = source.slice(at + 1);
  const next = rest.search(/\n(?:export )?(?:function|const) /);
  return next < 0 ? rest : rest.slice(0, next);
};

const band = () => bodyOf(code(RENDERER), "function SameDayCountdownSection(");

describe("the clock the band counts down on", () => {
  const instant = new Date("2026-09-26T08:00:00Z");

  it("is the shop's, not the visitor's", () => {
    /*
      ASSERTS A DIFFERENCE BETWEEN TWO ZONES, so it cannot pass vacuously on a
      runner that happens to sit in one of them.
    */
    expect(shopClockNow("Asia/Kolkata", instant).getHours()).toBe(13);
    expect(shopClockNow("Asia/Kolkata", instant).getMinutes()).toBe(30);
    expect(shopClockNow("Europe/London", instant).getHours()).toBe(9);

    // The one that matters: 30 minutes left to a Kota 14:00, read from London.
    expect(timeLeftToday("14:00", shopClockNow("Asia/Kolkata", instant))).toBe("00:30:00");
  });

  it("falls back rather than throwing inside a render", () => {
    expect(shopClockNow("Not/AZone", instant).getTime()).toBe(instant.getTime());
  });
});

describe("what a screen reader is given instead of ticking digits", () => {
  it("says the time left in a form that stays true for a minute", () => {
    expect(countdownParts("05:12:09")).toEqual({
      hours: "05",
      minutes: "12",
      seconds: "09",
      spoken: "5 hours 12 minutes left",
    });
    expect(countdownParts("01:01:00")!.spoken).toBe("1 hour 1 minute left");
    // "0 minutes left" is not what 40 seconds is.
    expect(countdownParts("00:00:40")!.spoken).toBe("less than a minute left");
  });

  it("and refuses anything that is not that shape, rather than drawing NaN", () => {
    for (const bad of [null, "", "5:12:09", "05:75:09", "05:12", "abc"]) {
      expect(countdownParts(bad as string | null), String(bad)).toBeNull();
    }
  });
});

describe("the band on the page", () => {
  it("takes its number from the server and from nowhere else", () => {
    const body = band();
    expect(body).toContain('props.trust?.sameDayCutoff ?? ""');
    // A demo constant comes back in exactly this shape.
    expect(body).not.toMatch(/\?\?\s*"\d{2}:\d{2}"/);
    expect(body).not.toMatch(/getCommerceSettings|defaultCommerceSettings/);
  });

  it("draws nothing without BOTH a live countdown and the shop's line", () => {
    const body = band();
    expect(body).toContain("if (!parts || !headline) {");
    expect(body).toContain("if (!props.interactive) return null;");
  });

  it("never reads a clock during render", () => {
    const body = band();
    expect(body).toContain("useSameDayCountdown(cutoff)");
    expect(body).not.toContain("new Date(");

    const hook = code("hooks/use-same-day-countdown.ts");
    expect(hook).toContain("useState<string | null>(null)");
    expect(
      hook.slice(0, hook.indexOf("useEffect")).includes("timeLeftToday"),
      "a server-rendered clock",
    ).toBe(false);
  });

  it("is not announced once a second, and does not jitter", () => {
    const body = band();
    expect(body).toContain('aria-hidden="true"');
    expect(body).toContain("sr-only");
    expect(body).not.toContain("aria-live");
    expect(body).not.toContain('role="timer"');
    expect(body).toContain("tabular-nums");
  });

  it("carries none of the reference's colour and no colour of its own", () => {
    const body = band();
    expect(body).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(body).not.toMatch(/bg-band-|text-white|cream-50/);
    expect(body).toContain("bg-primary");
    expect(body).toContain("text-primary-foreground");
  });

  it("and the server decides by the rule, not by copying the setting", () => {
    const source = code("apps/website/lib/storefront-trust.server.ts");
    expect(source).toContain("sameDayCutoff: sameDayCutoffFor(");
    expect(source).not.toMatch(/sameDayCutoff:\s*commerce/);
  });
});

describe("the words it ships", () => {
  const entry = HOMEPAGE_SECTION_REGISTRY.find((s) => s.type === "same-day-countdown");

  it("exists and is wired into the switch", () => {
    expect(entry, "the band is gone from the registry").toBeTruthy();
    expect(read(RENDERER)).toContain('case "same-day-countdown":');
  });

  it("ships none", () => {
    /*
      "Hours left for today's delivery" and "EXPLORE NOW" are the reference's
      own words, and three of the four labels that had to be scrubbed off this
      page were typed straight out of a shipped default or a placeholder.
    */
    for (const [key, value] of Object.entries(entry!.defaultContent)) {
      expect(value, `${key} ships with words in it`).toBe("");
    }
    for (const field of entry!.fields) {
      expect(field.placeholder ?? "", `${field.key} suggests wording`).toBe("");
    }
  });

  it("and has an icon both builder lists know", () => {
    // Five entries already fall back silently, in two hand-written maps with
    // two different fallbacks — a sparkle in one list and a heart in the other.
    for (const path of [
      "apps/admin/builders/shared/add-section-dialog.tsx",
      "apps/admin/builders/shared/section-list-panel.tsx",
    ]) {
      expect(read(path), `${path.split("/").pop()} does not know Clock`).toContain(
        `  ${entry!.icon},`,
      );
    }
  });
});
