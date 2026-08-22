/**
 * Two things the mail path got wrong that no amount of correct SMTP fixes.
 *
 * The transport itself is sound and is covered against a real socket by
 * `lib/server/mail/send-mail.test.ts`. These are the two failures that survive
 * a perfectly configured mail server: a link nobody can open, and a credential
 * that should never have been in a browser.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { seedEmailTemplates } from "@/features/communications/lib/email-template-seed";
import { TEMPLATE_VARIABLE_CONTRACT } from "@/features/communications/lib/template-contract";

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
    // The SEO store seeds `canonicalBaseUrl` as "https://www.your-bakery.example".
    // `.example` is reserved by RFC 2606 so that it never resolves — so every
    // order confirmation went out with a "view your invoice" link pointing at a
    // host that does not exist. The mail sent, the customer clicked, nothing
    // happened. The caller's fallback is a sentence that actually works, so an
    // empty origin is strictly better than that link.
    state.seoBase = "https://www.your-bakery.example";
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

describe("every seeded template either has a sender or admits it does not", () => {
  it("wires the slugs the admin can edit to something that actually sends them", async () => {
    const { seedEmailTemplates } = await import(
      "@/features/communications/lib/email-template-seed"
    );
    const senders = readFileSync(
      join(process.cwd(), "features/communications/server/email.service.ts"),
      "utf8",
    );

    // `order_shipped` and `invoice` were seeded ACTIVE and shown in the template
    // editor while nothing sent them — an admin could word an out-for-delivery
    // email that no customer would ever receive. Anything ACTIVE has to be
    // sendable; a template that is genuinely not built yet belongs in `draft`,
    // which is what the editor already uses to mean "work in progress".
    const active = seedEmailTemplates().filter((t) => t.status === "active");
    expect(active.length).toBeGreaterThan(0);

    // `EmailTemplateSlug` is the union `sendTemplatedEmail` accepts, so
    // membership of it IS the question "can anything send this?".
    //
    // The first version of this check built a RegExp per slug and the heredoc
    // that wrote it ate the leading backslash, leaving a pattern starting with
    // `|` — an empty alternative, which matches everything. It passed while
    // `welcome` was still unsendable. Reading the union is not clever, and that
    // is the point.
    const union = senders.slice(
      senders.indexOf("export type EmailTemplateSlug"),
      senders.indexOf(";", senders.indexOf("export type EmailTemplateSlug")),
    );
    expect(union).toContain("order_confirmation");

    const unsendable = active
      .map((t) => t.slug)
      .filter((slug) => !union.includes(`"${slug}"`));

    expect(unsendable).toEqual([]);
  });

  it("gives the admin a template for every email the shop sends", () => {
    // The other direction, and the one that was wrong for longer.
    //
    // `refund_processed` and `admin_new_order` were sent from hardcoded
    // `FALLBACKS` in email.service.ts with no row in the editor at all. Nothing
    // looked broken — the emails went out, correctly worded — but the shop had
    // no way to change a single word of them. The refund one is the sharper
    // miss: it is the only email a customer receives about their money.
    const seeded = seedEmailTemplates().map((template) => template.slug);

    for (const slug of Object.keys(TEMPLATE_VARIABLE_CONTRACT)) {
      expect(seeded, `nothing in the editor for ${slug}`).toContain(slug);
    }
  });
});

describe("the template test-send", () => {
  it("never takes its recipient from the caller", () => {
    const controller = readFileSync(
      join(process.cwd(), "features/communications/server/communications.controller.ts"),
      "utf8",
    );
    // A free-text recipient would make this a way to send mail from the shop's
    // domain to anyone. The SMTP test already made this decision; the template
    // test now follows it.
    expect(controller).toContain("service.sendTemplateTest(slug, session.email)");

    const validator = readFileSync(
      join(process.cwd(), "features/communications/server/communications.validators.ts"),
      "utf8",
    );
    // The schema accepts a slug and nothing else, so there is no recipient field
    // to smuggle one through.
    expect(validator).toMatch(/templateTestSchema = z\.object\(\{\s*slug:/);
  });

  it("renders through the same escaping a real send uses", () => {
    const service = readFileSync(
      join(process.cwd(), "features/communications/server/communications.service.ts"),
      "utf8",
    );
    // Two escaping implementations would mean the test proving something other
    // than what the customer receives.
    expect(service).toContain("toEmailHtml(");
  });
});
