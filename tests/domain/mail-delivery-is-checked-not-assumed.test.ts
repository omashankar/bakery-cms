/**
 * MAIL DELIVERY IS CHECKED, NOT ASSUMED.
 *
 * The shop's mail provider accepted every invitation and order confirmation
 * ("250 queued") and customers saw nothing. Settings → SMTP now reads what
 * decides delivery: the sending domain's DNS, and — for Brevo, with a key on
 * the server — whether the sender is verified, the domain authenticated, and
 * what Brevo did with each recent message.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const zone = vi.hoisted(() => ({
  txt: {} as Record<string, string[][]>,
  cname: {} as Record<string, string[]>,
}));
vi.mock("node:dns", () => {
  const promises = {
    resolveTxt: async (name: string) => {
      if (zone.txt[name]) return zone.txt[name];
      throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    },
    resolveCname: async (name: string) => {
      if (zone.cname[name]) return zone.cname[name];
      throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    },
  };
  return { promises, default: { promises } };
});

import { checkBrevo, checkDns, runDeliveryCheck } from "@/lib/server/mail/delivery-check";

beforeEach(() => {
  zone.txt = {};
  zone.cname = {};
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BREVO_API_KEY;
});

describe("the sending domain's DNS", () => {
  it("passes a domain set up the way Brevo asks", async () => {
    zone.txt["shop.in"] = [["v=spf1 include:spf.brevo.com ~all"]];
    zone.txt["_dmarc.shop.in"] = [["v=DMARC1; p=none"]];
    zone.cname["brevo1._domainkey.shop.in"] = ["b1.shop-in.dkim.brevo.com"];
    zone.cname["brevo2._domainkey.shop.in"] = ["b2.shop-in.dkim.brevo.com"];
    const dns = await checkDns("shop.in", "brevo");
    expect([dns.spf.ok, dns.dkim.ok, dns.dmarc.ok]).toEqual([true, true, true]);
  });

  it("says exactly what to add when SPF names another provider — this shop's case", async () => {
    zone.txt["zend-apps.com"] = [["v=spf1 include:_spf.smtp.mailtrap.live ~all"]];
    const dns = await checkDns("zend-apps.com", "brevo");
    expect(dns.spf.ok).toBe(false);
    expect(dns.spf.note).toContain("v=spf1 include:_spf.smtp.mailtrap.live include:spf.brevo.com ~all");
  });

  it("flags missing DKIM and DMARC", async () => {
    const dns = await checkDns("bare.in", "brevo");
    expect(dns.dkim.ok).toBe(false);
    expect(dns.dmarc.ok).toBe(false);
    expect(dns.dmarc.note).toContain("v=DMARC1; p=none");
  });
});

describe("Brevo's side", () => {
  it("says how to see it when no key is set, instead of failing", async () => {
    const report = await checkBrevo("info@shop.in", undefined);
    expect(report.error).toMatch(/BREVO_API_KEY/);
  });

  it("finds an unverified sender, an unauthenticated domain and a blocked message", async () => {
    const seen: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: { headers: Record<string, string> }) => {
      seen.push(`${url} key=${init.headers["api-key"]}`);
      const body = url.endsWith("/account")
        ? { email: "owner@shop.in", companyName: "Shop", plan: [{ type: "free", credits: 280 }] }
        : url.endsWith("/senders")
          ? { senders: [{ email: "info@shop.in", active: false }] }
          : url.endsWith("/senders/domains")
            ? { domains: [{ domain_name: "shop.in", authenticated: false, verified: true }] }
            : { events: [{ date: "2026-11-02T10:00:00Z", email: "riya@example.com", subject: "Your order", event: "blocked", reason: "sender not verified" }] };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const report = await checkBrevo("info@shop.in", "xkeysib-test");
    expect(report.sender).toEqual({ email: "info@shop.in", verified: false });
    expect(report.domain).toMatchObject({ authenticated: false });
    expect(report.events?.[0]).toMatchObject({ event: "blocked", reason: "sender not verified" });
    expect(report.account?.credits).toBe(280);
    expect(seen.every((line) => line.startsWith("https://api.brevo.com/v3/") && line.endsWith("key=xkeysib-test"))).toBe(true);
  });

  it("reports a refused key in words", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ message: "Key not found" }), { status: 401 }));
    expect((await checkBrevo("info@shop.in", "bad")).error).toBe("Brevo refused the API key.");
  });

  it("is asked only when the mail server is Brevo", async () => {
    process.env.BREVO_API_KEY = "xkeysib-test";
    const other = await runDeliveryCheck({ host: "smtp.gmail.com", fromEmail: "me@gmail.com" });
    expect(other.brevo).toBeNull();
    const brevo = await runDeliveryCheck({ host: "smtp-relay.brevo.com", fromEmail: "info@shop.in" });
    expect(brevo.provider).toBe("brevo");
  });
});
