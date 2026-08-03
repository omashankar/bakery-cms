/**
 * Two things the mail path got wrong that no amount of correct SMTP fixes.
 *
 * The transport itself is sound and is covered against a real socket by
 * `lib/server/mail/send-mail.test.ts`. These are the two failures that survive
 * a perfectly configured mail server: a link nobody can open, and a credential
 * that should never have been in a browser.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  seoBase: "" as string,
  stored: {} as Record<string, unknown>,
}));

vi.mock("@/features/site-layout/server/site-layout.service", () => ({
  getSiteLayout: async () => ({ global: { canonicalBaseUrl: state.seoBase } }),
}));

import { publicBaseUrl } from "@/features/communications/server/email.service";

const ENV_KEY = "NEXT_PUBLIC_SITE_URL";
const originalEnv = process.env[ENV_KEY];

beforeEach(() => {
  delete process.env[ENV_KEY];
  state.seoBase = "";
});

afterEach(() => {
  if (originalEnv === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = originalEnv;
});

describe("the origin used for links inside an email", () => {
  it("refuses the seeded demo domain", async () => {
    // The SEO store seeds `canonicalBaseUrl` as "https://www.monginis.example".
    // `.example` is reserved by RFC 2606 so that it never resolves — so every
    // order confirmation went out with a "view your invoice" link pointing at a
    // host that does not exist. The mail sent, the customer clicked, nothing
    // happened. The caller's fallback is a sentence that actually works, so an
    // empty origin is strictly better than that link.
    state.seoBase = "https://www.monginis.example";
    expect(await publicBaseUrl()).toBe("");
  });

  it("refuses the other reserved names, and anything with no scheme", async () => {
    for (const base of [
      "https://shop.invalid",
      "https://shop.test",
      "http://localhost:3000",
      "www.realbakery.com",
      "ftp://shop.example.com",
    ]) {
      state.seoBase = base;
      expect(await publicBaseUrl()).toBe("");
    }
  });

  it("accepts a real origin and strips a trailing slash", async () => {
    state.seoBase = "https://www.sharmacakes.in/";
    expect(await publicBaseUrl()).toBe("https://www.sharmacakes.in");
  });

  it("lets the env var override, but holds it to the same rule", async () => {
    state.seoBase = "https://www.sharmacakes.in";

    process.env[ENV_KEY] = "https://staging.sharmacakes.in";
    expect(await publicBaseUrl()).toBe("https://staging.sharmacakes.in");

    // A misconfigured override must fall through to the SEO value rather than
    // poisoning every link with it.
    process.env[ENV_KEY] = "https://staging.example";
    expect(await publicBaseUrl()).toBe("https://www.sharmacakes.in");
  });
});

describe("the mail password at the HTTP boundary", () => {
  it("is redacted on read, and reported only as set/unset", async () => {
    // It used to cross in cleartext, and from there the settings store wrote it
    // to localStorage — where it survived logout, rode to every device that
    // admin signed in from, was readable by any script on any admin page, and
    // was swept into every downloadable backup file. This codebase had already
    // decided that was unacceptable for the Razorpay key secret; SMTP had not
    // been given the same treatment.
    const { redactMailPassword } = await import(
      "@/features/settings/server/settings.controller"
    );

    const withSecret = { smtp: { host: "smtp.sendgrid.net", password: "SG.real-secret" } };
    const out = redactMailPassword(withSecret as never) as unknown as {
      smtp: { password: string; passwordSet: boolean; host: string };
    };

    expect(out.smtp.password).toBe("");
    expect(out.smtp.passwordSet).toBe(true);
    // Everything else still crosses — only the secret is withheld.
    expect(out.smtp.host).toBe("smtp.sendgrid.net");
    expect(JSON.stringify(out)).not.toContain("SG.real-secret");
  });

  it("reports passwordSet false when the server holds none", async () => {
    const { redactMailPassword } = await import(
      "@/features/settings/server/settings.controller"
    );
    const out = redactMailPassword({ smtp: { host: "relay.internal", password: "" } } as never) as unknown as {
      smtp: { passwordSet: boolean };
    };
    expect(out.smtp.passwordSet).toBe(false);
  });
});
