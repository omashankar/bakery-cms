import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { extractTrackingId, isUsableTrackingId } from "@/features/settings/lib/tracking-id";

/**
 * The shop pasted what Google gave it, and got no analytics at all.
 *
 * Google's setup panel does not hand anybody a bare "G-XXXXXXXXXX". It hands
 * over a whole `<script>` block and says to paste it into the site — so pasting
 * that block into a box labelled "Google Analytics (GA4)" is the obvious thing
 * to do. It was accepted, saved, echoed back in the field, and counted as
 * configured on the settings index.
 *
 * And the storefront rendered nothing. `storefront-scripts.server.ts` tests
 * every stored id against a bare-id pattern and substitutes "" for anything
 * else — which is right, because an unchecked string goes straight into a
 * `<script>` tag — but it is silent, and it happens a server away from the
 * person who pasted. They never got a single pageview and nothing said why.
 *
 * Refusing the paste would have been honest and useless: the thing refused is
 * exactly what the provider told them to use. So the id is pulled out of it.
 */

/** What Google's own panel puts on the clipboard, near enough. */
const GA4_SNIPPET = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-7PQ2LMN4XY"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-7PQ2LMN4XY');
</script>`;

const GTM_SNIPPET = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];
})(window,document,'script','dataLayer','GTM-WX9K2ZQ');</script>`;

const PIXEL_SNIPPET = `<script>
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){};}
  (window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '284619375012994');
  fbq('track', 'PageView');
</script>`;

const HOTJAR_SNIPPET = `<script>
  (function(h,o,t,j,a,r){ h.hj=h.hj||function(){};
  h._hjSettings={hjid:3847291,hjsv:6};
  })(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
</script>`;

describe("the id is taken out of what the provider handed over", () => {
  it("finds a GA4 id in Google's own block", () => {
    expect(extractTrackingId(GA4_SNIPPET, "ga4")).toBe("G-7PQ2LMN4XY");
  });

  it("finds a Tag Manager container in its block", () => {
    expect(extractTrackingId(GTM_SNIPPET, "gtm")).toBe("GTM-WX9K2ZQ");
  });

  it("takes the Meta pixel from the init call, not from the version numbers", () => {
    /**
     * The pasted Meta block also carries a version and a URL full of digits. A
     * naive "longest run of digits" picks one of those about as often as it
     * picks the id — and picking wrong SILENTLY is how this defect began.
     */
    expect(extractTrackingId(PIXEL_SNIPPET, "pixel")).toBe("284619375012994");
  });

  it("takes the Hotjar id from hjid, not from hjsv beside it", () => {
    expect(extractTrackingId(HOTJAR_SNIPPET, "hotjar")).toBe("3847291");
  });
});

describe("what it does with everything else", () => {
  it("leaves a bare id exactly as the shop typed it", () => {
    for (const [value, kind] of [
      ["G-7PQ2LMN4XY", "ga4"],
      ["GTM-WX9K2ZQ", "gtm"],
      ["284619375012994", "pixel"],
      ["3847291", "hotjar"],
    ] as const) {
      expect(extractTrackingId(value, kind), value).toBe(value);
    }
  });

  it("trims, and treats an empty box as empty", () => {
    expect(extractTrackingId("  G-ABC123  ", "ga4")).toBe("G-ABC123");
    expect(extractTrackingId("   ", "ga4")).toBe("");
  });

  it("hands back what it cannot read, rather than a fragment", () => {
    /**
     * A value the caller cannot use comes back as typed, so the screen can say
     * so. Storing half of something is worse than storing the wrong thing:
     * nobody can see that it was ever cut.
     */
    expect(extractTrackingId("ask my nephew", "ga4")).toBe("ask my nephew");
    expect(isUsableTrackingId("ask my nephew")).toBe(false);
  });

  it("refuses to guess between two numbers", () => {
    // One run of digits in a pasted dashboard line is unambiguous. Two is a
    // coin toss, and a silent coin toss is the bug.
    expect(extractTrackingId("Pixel 12345678 · account 98765432", "pixel")).toContain("12345678");
    expect(isUsableTrackingId(extractTrackingId("12345678 98765432", "pixel"))).toBe(false);
  });

  it("agrees with the server about what will actually be rendered", () => {
    /**
     * `isUsableTrackingId` exists so the admin can tell the shop what the
     * server is about to decide. If the two ever disagree, the screen goes back
     * to promising analytics that never arrive.
     */
    const server = readFileSync(
      join(process.cwd(), "features/settings/server/storefront-scripts.server.ts"),
      "utf8",
    );

    expect(server).toContain("/^[A-Za-z0-9_-]{1,64}$/");
    expect(isUsableTrackingId("G-7PQ2LMN4XY")).toBe(true);
    expect(isUsableTrackingId("<script>G-7PQ2LMN4XY</script>")).toBe(false);
    expect(isUsableTrackingId("")).toBe(true);
  });
});

describe("the screen actually uses it", () => {
  const page = readFileSync(
    join(process.cwd(), "apps/admin/settings/components/analytics-settings-page.tsx"),
    "utf8",
  );

  it("settles all four boxes", () => {
    for (const kind of ["ga4", "gtm", "pixel", "hotjar"]) {
      expect(page, kind).toContain(`settle("${kind}"`);
    }
  });

  it("settles on blur, not on every keystroke", () => {
    // Rewriting mid-keystroke would fight a shop typing "G-" by hand.
    expect(page.split("onBlur={(e) =>").length - 1).toBe(4);
  });

  it("and says a pasted block is welcome", () => {
    expect(page).toContain("If it is a whole script block, the");
    expect(page).not.toContain("Paste measurement IDs from Google Analytics");
  });
});
