/**
 * The shop sent no security headers at all.
 *
 * The one that matters most is frame denial. Without it any site can put this
 * admin panel in an invisible iframe over its own buttons, so an owner who is
 * signed in and visits a malicious page can be clicked into issuing a refund,
 * deleting the catalogue or revoking a session without ever seeing what they
 * pressed. None of those actions asks for a password again — reasonable for a
 * shop, and exactly what makes the frame the whole attack.
 *
 * These are asserted against the CONFIG rather than a live response because
 * that is where the decision lives, and because two of them are conditional:
 * HSTS must not be sent in development, and `payment` must stay OUT of the
 * permissions list. Both are the kind of thing a later edit "tidies" without
 * knowing why.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const config = () => readFileSync(join(process.cwd(), "next.config.ts"), "utf8");

/**
 * Block comments that START a line, and nothing else.
 *
 * The ordinary `/\/\*[\s\S]*?\*\//` stripper cannot be used on THIS file. It
 * contains the image path `` `/${cloudinaryCloudName}/**` `` — and that `/**`
 * opens a comment as far as the regex is concerned, so everything up to the
 * next `*​/` disappeared, `async headers()` among it. The test then failed with
 * "no headers are configured at all" against a config that configures them,
 * and it would just as happily have PASSED a negative assertion by deleting the
 * code it was meant to inspect.
 *
 * Every real docblock here begins its own line; a `/**` inside a string never
 * does.
 */
const stripComments = (code: string) =>
  code.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, " ").replace(/^[ \t]*\/\/[^\n]*/gm, " ");

describe("every response", () => {
  const headers = () => {
    const code = stripComments(config());
    const at = code.indexOf("const SECURITY_HEADERS");
    expect(at, "the security header list is gone").toBeGreaterThan(-1);
    return code.slice(at, code.indexOf("];", at));
  };

  it("refuses to be framed, in both spellings", () => {
    // `X-Frame-Options` for older browsers, `frame-ancestors` for the ones that
    // ignore it. Sending only one leaves a real share of visitors unprotected.
    const list = headers();
    expect(list, "the admin can be framed by any site").toContain('"X-Frame-Options"');
    expect(list).toMatch(/X-Frame-Options[\s\S]{0,40}DENY/);
    expect(list, "modern browsers are not told to refuse the frame").toMatch(
      /frame-ancestors 'none'/,
    );
  });

  it("does not sniff content types", () => {
    // An uploaded file served as one thing and sniffed as another is how a
    // media library becomes a script host.
    expect(headers()).toMatch(/X-Content-Type-Options[\s\S]{0,30}nosniff/);
  });

  it("does not leak the full URL to other sites", () => {
    // Order numbers and password-reset tokens live in URLs, and a full referer
    // puts them in someone else's logs.
    expect(headers()).toMatch(/Referrer-Policy[\s\S]{0,60}strict-origin/);
  });

  it("is applied to the storefront as well as the admin", () => {
    /**
     * One rule matching everything, on purpose.
     *
     * Next appends the headers of every matching rule, so a second rule setting
     * a different `X-Frame-Options` would send both values and leave the
     * browser to pick. Nothing in this app frames its own pages, so one rule is
     * both simpler and stricter.
     */
    const code = stripComments(config());
    const at = code.indexOf("async headers()");
    expect(at, "no headers are configured at all").toBeGreaterThan(-1);

    const block = code.slice(at, code.indexOf("async redirects()", at));
    expect(block, "the header rule does not cover every path").toContain('source: "/:path*"');

    const rules = block.match(/source:/g) ?? [];
    expect(
      rules.length,
      "a second header rule can send a conflicting X-Frame-Options alongside the first",
    ).toBe(1);
  });
});

describe("the two that are conditional", () => {
  /**
   * RUN, under both environments.
   *
   * The first version of this read the config as text and checked that the
   * headers block mentioned `NODE_ENV` and "production". Adding HSTS to the
   * development branch as well leaves both of those true, so the test passed
   * for a config that sent HSTS on localhost — the exact thing it is named
   * after. The function is asked instead.
   */
  async function headersFor(environment: string) {
    vi.stubEnv("NODE_ENV", environment as "production" | "development");
    // Imported fresh each time: the module is evaluated once per import, and
    // `headers()` reads the environment at CALL time, so one import is enough —
    // but resetting keeps this honest if the config is ever hoisted.
    const { default: loaded } = await import("../../next.config");
    const rules = (await loaded.headers?.()) ?? [];
    return rules.flatMap((rule) => rule.headers.map((header) => header.key));
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends HSTS in production", async () => {
    expect(await headersFor("production")).toContain("Strict-Transport-Security");
  });

  it("does NOT send HSTS in development", async () => {
    /**
     * A browser that sees HSTS on localhost remembers it for the whole max-age
     * and then refuses to load `http://localhost` at all — for every project on
     * the machine, because the policy is stored per host. That is painful to
     * undo, so the gate is the point, not a detail.
     */
    expect(
      await headersFor("development"),
      "HSTS on localhost pins every local project to https for two years",
    ).not.toContain("Strict-Transport-Security");
  });

  it("sends the rest in both", async () => {
    // The gate is only meant to hold back HSTS; everything else protects a
    // developer's browser exactly as it protects a customer's.
    for (const environment of ["production", "development"]) {
      const keys = await headersFor(environment);
      expect(keys, `${environment} is missing frame denial`).toContain("X-Frame-Options");
      expect(keys).toContain("Content-Security-Policy");
      expect(keys).toContain("X-Content-Type-Options");
      expect(keys).toContain("Referrer-Policy");
    }
  });

  it("never denies the payment permission", () => {
    /**
     * `payment=()` disables the Payment Request API, and Permissions-Policy
     * propagates into iframes — Razorpay's checkout runs in one, and that API
     * is behind its Google Pay flow. Denying it would break paying for a cake
     * to close a permission this app was never going to use.
     */
    const code = stripComments(config());
    const at = code.indexOf("Permissions-Policy");
    expect(at, "the permissions policy is gone").toBeGreaterThan(-1);

    const value = code.slice(at, code.indexOf("}", at));
    expect(value, "the payment permission is denied — this breaks Razorpay's Google Pay").not.toMatch(
      /payment\s*=/,
    );
    // The ones that ARE denied are genuinely unused: nothing in the tree calls
    // getUserMedia or navigator.geolocation.
    expect(value).toMatch(/camera=\(\)/);
    expect(value).toMatch(/geolocation=\(\)/);
  });

  it("stops announcing the framework and its version", () => {
    expect(stripComments(config()), "X-Powered-By still names Next.js").toContain(
      "poweredByHeader: false",
    );
  });
});

describe("the front door", () => {
  /**
   * `app/page.tsx` renders this product's own marketing page — "Bakery CMS —
   * Complete Bakery Business Management Platform", with a Pricing section. That
   * is the right page for whoever SELLS this software and the wrong one for
   * every shop running it: a customer arriving from Instagram, a printed card
   * or a search result met an advert for a dashboard instead of the cakes — as
   * did anyone following the "Powered by" credit the storefront footer used to
   * carry. That credit is gone; this redirect is what still has to hold.
   */
  it("sends the bare domain to the shop", async () => {
    const { default: loaded } = await import("../../next.config");
    const rules = (await loaded.redirects?.()) ?? [];
    const root = rules.find((rule) => rule.source === "/");

    expect(root, "the bare domain still serves the CMS vendor's sales page").toBeDefined();
    expect(root?.destination).toBe("/store");
  });

  it("keeps that redirect temporary", () => {
    /**
     * A permanent redirect is cached by the browser more or less forever, and
     * this is a decision a deployment might reasonably reverse — the vendor's
     * own site wants that page at its root. Shipping it as 308 would make
     * "put the marketing page back" unreachable for every visitor who had
     * already seen it once.
     */
    const code = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    const at = code.indexOf('source: "/",');
    expect(at, "the root redirect is gone").toBeGreaterThan(-1);

    expect(
      code.slice(at, code.indexOf("}", at)),
      "the root redirect is permanent — a visitor could never see the page again",
    ).toContain("permanent: false");
  });
});
