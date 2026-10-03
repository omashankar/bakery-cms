/**
 * THE HOMEPAGE MOVED 292px UNDER THE READER, 900ms IN.
 *
 * Measured on the production build at 390, on a first visit: CLS 0.152 in
 * a single shift at ~910ms, against a 0.1 budget. The band that reads
 * "Same-day orders close at 14:00 today" is 292px tall and was NOT in the
 * served HTML — checked by stripping every <script> from the response,
 * where "Must Have" and "Shop by category" are present and "Same-day
 * orders close" is not. It arrived with the JavaScript and pushed the
 * whole page down.
 *
 * (An earlier measurement in the same session reported CLS 0 everywhere.
 * That was taken on warm repeat visits. This is what a first-time visitor
 * gets, and it is the one that counts.)
 *
 * WHY IT WAS CLIENT-ONLY, and what did not change. `useSameDayCountdown`
 * starts at null and fills in from an effect, because it needs the SHOP's
 * clock rather than the visitor's and reads the timezone from module state
 * that is only reliable after render. That reasoning stands.
 *
 * WHAT CHANGED is where the FIRST value comes from. The server already
 * reads this shop's settings to decide whether there is a same-day window
 * at all, and the timezone is in the same document — so it works out the
 * first countdown too and sends it as data.
 *
 * THAT IS WHY HYDRATION STAYS QUIET. The value crosses as a prop,
 * serialized into the payload, so the server's render and the browser's
 * first render use the identical string down to the digit. The effect owns
 * every value after the first. Nothing is computed twice from two clocks.
 *
 * THIS FILE CAN RUN AT ANY HOUR, which is the point of testing the reader
 * rather than the page: at 15:15 with a 14:00 cutoff the band correctly
 * draws nothing, so a browser check would pass for the wrong reason for
 * most of the day.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const TRUST = "apps/website/lib/storefront-trust.server.ts";
const HOOK = "hooks/use-same-day-countdown.ts";
const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

/** A settings document with a same-day window that closes at `cutoff`. */
function shopThatCloses(cutoff: string) {
  return {
    general: { timezone: "Asia/Kolkata" },
    commerce: {
      sameDayCutoff: cutoff,
      deliveryLeadDays: 0,
      freeDeliveryThreshold: 999,
    },
  } as never;
}

/** `HH:MM` on the shop's clock, offset by whole minutes. */
function shopTimePlus(minutes: number): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")!.value);
  const m = Number(parts.find((p) => p.type === "minute")!.value);
  const total = h * 60 + m + minutes;
  const wrapped = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

describe("the server works out the first countdown", () => {
  it("hands back the time left when the window is still open", async () => {
    /*
      ASKED OF THE READER, NOT A PAGE, so this runs at any hour. With a
      14:00 cutoff and a 15:15 clock the band correctly draws nothing, and
      a browser check would then pass without rendering the thing it is
      about — for most of the working day.

      The cutoff is set relative to the shop's own clock so the window is
      open whenever this runs.
    */
    vi.resetModules();
    const { getStorefrontTrust } = await import("@/apps/website/lib/storefront-trust.server");

    const trust = await getStorefrontTrust(shopThatCloses(shopTimePlus(90)));
    expect(trust, "the trust reader returned nothing at all").toBeTruthy();
    expect(
      trust!.sameDayTimeLeft,
      "the server sends no countdown, so the band is absent from the HTML again",
    ).toBeTruthy();
  });

  it("and nothing once it has closed", async () => {
    /*
      THE OTHER HALF, and it is not symmetry for its own sake: a band that
      counts down to a deadline that has passed is telling somebody to
      hurry for a delivery they can no longer have.
    */
    vi.resetModules();
    const { getStorefrontTrust } = await import("@/apps/website/lib/storefront-trust.server");

    const trust = await getStorefrontTrust(shopThatCloses(shopTimePlus(-90)));
    expect(trust!.sameDayTimeLeft, "a closed window still sends a countdown").toBeNull();
  });

  it("and nothing at all for a shop that cannot deliver today", async () => {
    vi.resetModules();
    const { getStorefrontTrust } = await import("@/apps/website/lib/storefront-trust.server");

    const trust = await getStorefrontTrust({
      general: { timezone: "Asia/Kolkata" },
      commerce: { sameDayCutoff: shopTimePlus(90), deliveryLeadDays: 2 },
    } as never);
    expect(trust!.sameDayCutoff, "a two-day lead time still names a cutoff").toBe("");
    expect(trust!.sameDayTimeLeft, "a two-day lead time still counts down").toBeNull();
  });
});

describe("and the band paints it on the first render", () => {
  it("the hook starts from what the server sent", () => {
    /*
      THE WHOLE FIX IS THIS LINE. `useState<string | null>(null)` is a band
      that is absent from the HTML and appears ~900ms later; seeded, it is
      in the HTML.
    */
    const hook = code(HOOK);
    expect(hook, "the hook no longer accepts a server value").toMatch(
      /initial\?: string \| null/,
    );
    expect(hook, "the hook starts from null again — the band will be late").toContain(
      "useState<string | null>(initial ?? null)",
    );
  });

  it("and the section hands it over", () => {
    const renderer = code(RENDERER);
    expect(renderer, "the band stopped reading the server's countdown").toContain(
      "useSameDayCountdown(cutoff, props.trust?.sameDayTimeLeft)",
    );
  });

  it("through a prop, which is what keeps hydration quiet", () => {
    /*
      NOT A SECOND READING OF THE CLOCK. If the browser worked the value
      out itself during render, the server's string and the first client
      string would differ by whatever time passed between them — a
      mismatch at every tick boundary and a structural one at the hour,
      where the number of cells changes.

      So the renderer must take it from props, and the trust reader must be
      the only thing calling the clock.
    */
    const renderer = code(RENDERER);
    expect(renderer, "the renderer reads the clock itself again").not.toContain("shopClockNow");
    expect(code(TRUST), "the server stopped reading the clock").toContain("shopClockNow(");
  });
});
