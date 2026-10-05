import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  countdownCells,
  countdownParts,
  shopClockNow,
  timeLeftToday,
} from "@/features/orders/lib/delivery-date";
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
    /*
      THE CLAIM IS THE SAME; THE FIRST VALUE NOW ARRIVES AS A PROP.

      The band used to be absent from the served HTML — the hook started at
      null and filled in from an effect, so 292px of it appeared about
      900ms later and pushed the homepage down (CLS 0.152 at 390). The
      server works the first countdown out now, from the settings document
      it was already reading, and sends it.

      That is still not "reading a clock during render": nothing here calls
      one. The value crosses as data, so the server's render and the
      browser's first render use the identical string and there is nothing
      to hydrate differently.

      The hazard this case was written against was a module-state locale
      read on the SSR pass — the shape active-locale.ts warns about — and
      nothing below calls `getActiveLocale`. The two assertions that carry
      that weight are kept: no clock in the hook before its effect, and now
      no clock in the band under any name.
    */
    const body = band();
    expect(body).toContain("useSameDayCountdown(cutoff, props.trust?.sameDayTimeLeft)");
    expect(body).not.toContain("new Date(");
    expect(body, "the band reads the shop clock itself").not.toContain("shopClockNow");

    const hook = code("hooks/use-same-day-countdown.ts");
    expect(hook).toContain("useState<string | null>(initial ?? null)");
    expect(
      hook.slice(0, hook.indexOf("useEffect")).includes("timeLeftToday"),
      "a server-rendered clock",
    ).toBe(false);
    expect(
      hook.includes("getActiveLocale()") && hook.indexOf("getActiveLocale()") < hook.indexOf("useEffect"),
      "the locale is read during render again",
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
    /*
      THE CALL IS HOISTED NOW, because the countdown sent beside it needs
      the same value and two calls to `sameDayCutoffFor` is how the two
      drift apart. So the case asserts the RULE — that the cutoff goes
      through that function and never straight off `commerce` — rather
      than the line it used to sit on.
    */
    const source = code("apps/website/lib/storefront-trust.server.ts");
    expect(source, "the cutoff stopped going through the rule").toMatch(
      /const cutoff = sameDayCutoffFor\(/,
    );
    expect(source, "the field stopped using it").toContain("sameDayCutoff: cutoff,");
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

describe("which units the clock shows", () => {
  const labels = (left: string) =>
    countdownCells(countdownParts(left)!).map(([label]) => label);
  const shown = (left: string) =>
    countdownCells(countdownParts(left)!).map(([, value]) => value);

  it("drops the units that are not there yet, and keeps two", () => {
    expect(labels("05:12:09")).toEqual(["Hours", "Minutes"]);
    expect(shown("05:12:09")).toEqual(["05", "12"]);

    expect(labels("00:12:09")).toEqual(["Minutes", "Seconds"]);
    expect(shown("00:12:09")).toEqual(["12", "09"]);
  });

  it("and narrows to one in the last minute, rather than reading “00”", () => {
    /*
      THE CASE A BRANCH ON HOURS ALONE GETS WRONG. `Number(parts.hours) > 0`
      is false here too, so an hours-only rule pairs Minutes with Seconds and
      draws "00 MINUTES | 09 SECONDS" — the dead cell the two-unit clock
      exists to remove, in the one minute of the day it is most visible.
    */
    expect(labels("00:00:09")).toEqual(["Seconds"]);
    expect(shown("00:00:09")).toEqual(["09"]);
  });

  it("never leads with a zero, at any second of a same-day window", () => {
    /*
      EVERY REACHABLE STATE, not three chosen ones: `timeLeftToday` can return
      any second from 23:59:59 down to 00:00:01, and refuses zero.
    */
    const pad = (n: number) => String(n).padStart(2, "0");
    const bad: string[] = [];
    for (let total = 1; total <= 24 * 3600; total += 1) {
      const left = `${pad(Math.floor(total / 3600))}:${pad(
        Math.floor(total / 60) % 60,
      )}:${pad(total % 60)}`;
      const parts = countdownParts(left);
      if (!parts) continue;
      const cells = countdownCells(parts);
      /*
        COLLECTED, NOT ASSERTED PER ITERATION. 86,400 `expect` calls take long
        enough to time this file out when the suite runs under contention —
        which is a flake, and a flake on a guard is worse than no guard.
      */
      if (cells.length < 1 || cells.length > 2 || Number(cells[0][1]) === 0) {
        bad.push(`${left} -> ${cells.map(([l, v]) => `${v} ${l}`).join(" | ")}`);
      }
    }
    expect(bad.slice(0, 5), "seconds the clock reads wrong").toEqual([]);
    expect(bad).toHaveLength(0);
  });

  it("and a trailing zero stays, because it is a reading", () => {
    // "01 hours 00 minutes" is an hour left. "00 hours" is a unit that is not
    // there — which is the one this drops, and the only one.
    expect(shown("01:00:30")).toEqual(["01", "00"]);
    expect(labels("01:00:30")).toEqual(["Hours", "Minutes"]);
  });

  it("is read by the band rather than re-derived inside it", () => {
    /*
      The rule is pure and tested above; this only pins that the band is the
      thing using it. An inline branch on `parts.hours` would pass every case
      above — they would be testing a function nothing calls.
    */
    const body = band();
    expect(body).toContain("countdownCells(parts)");
    expect(body).not.toMatch(/parts\.hours\s*[)>=!]/);
  });
});

describe("the wash on the card", () => {
  /**
   * `panelClassName` MAKES AN OLD TRAP EASIER TO FALL INTO.
   *
   * `SectionShell` applies it after the panel's tone, and `cn` is twMerge — so
   * a flat `bg-*` passed through it wins, and the shop's Background dropdown
   * silently stops doing anything. Three sections in this file shipped exactly
   * that once; one showed "White" in the builder while rendering cream.
   *
   * A gradient is safe, and is the whole point: `bg-[linear-gradient(...)]`
   * sets `background-image`, so the tone's `background-color` still shows
   * through every transparent stop. Proven in a browser too — swapping the
   * tone class on the live card moves the computed background-color and
   * leaves the gradient untouched.
   */
  it("never carries a flat colour, which would make the Background dropdown inert", () => {
    const source = code(RENDERER);
    const uses = [...source.matchAll(/panelClassName="([^"]*)"/g)].map((m) => m[1]);

    expect(uses.length, "nothing passes panelClassName any more").toBeGreaterThan(0);

    for (const value of uses) {
      for (const token of value.split(/\s+/).filter(Boolean)) {
        if (!token.startsWith("bg-")) continue;
        expect(
          token.startsWith("bg-[") && /gradient\(/.test(token),
          `panelClassName carries "${token}", which outranks the tone and leaves the Background dropdown doing nothing`,
        ).toBe(true);
      }
    }
  });

  it("is built from the shop's own tokens, not from colours chosen here", () => {
    const source = code(RENDERER);
    const value = /panelClassName="([^"]*)"/.exec(source)?.[1] ?? "";

    expect(value, "no wash is passed at all").toContain("gradient(");
    // The reference's own greens and blues come back in exactly this shape.
    expect(value, "a colour was written into the wash").not.toMatch(
      /#[0-9a-fA-F]{3,8}|rgb\(|hsl\(/,
    );
    expect(value, "the wash does not read a single shop token").toMatch(/var\(--/);
  });

  it("and the shell puts it after the tone, or it would be painted over", () => {
    const source = code(RENDERER);
    expect(
      source.indexOf("panelTone, panelClassName"),
      "the panel no longer layers the two in that order",
    ).toBeGreaterThan(-1);
  });
});
