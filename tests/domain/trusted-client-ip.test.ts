import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { clientIpFrom, proxyHeadersAreTrusted } from "@/lib/server/http/client-ip";
import { requestContext } from "@/lib/server/audit/audit-log";

/**
 * `x-forwarded-for` is written by the CLIENT unless something upstream
 * overwrites it — a reverse proxy APPENDS (`<whatever the client sent>, <real
 * ip>`), and with no proxy the header is entirely attacker-supplied.
 *
 * Maintenance mode learned this when its allow-list became an access decision.
 * The login throttle is an access decision too and did not: it keyed on the
 * FIRST hop, and the limiter mints a fresh bucket for any key it has not seen —
 * so "Max login attempts: 3" meant three attempts per header value, and one
 * extra header per request reset it. The same key throttled password-reset
 * mail, so the shop's SMTP account could be pumped the same way.
 */
const original = process.env.TRUST_PROXY_HEADERS;

afterEach(() => {
  if (original === undefined) delete process.env.TRUST_PROXY_HEADERS;
  else process.env.TRUST_PROXY_HEADERS = original;
});

const headers = (init: Record<string, string>) => new Headers(init);

describe("an IP the deployment cannot vouch for", () => {
  beforeEach(() => {
    delete process.env.TRUST_PROXY_HEADERS;
  });

  it("is not believed at all", () => {
    expect(proxyHeadersAreTrusted()).toBe(false);
    expect(clientIpFrom(headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("");
    expect(clientIpFrom(headers({ "x-real-ip": "1.2.3.4" }))).toBe("");
  });

  it("does not reach the audit trail either", () => {
    // A forgeable IP in the record of who did what is worse than no IP: the
    // Security Center prints it as the address an action came from.
    const request = new Request("http://localhost/api/x", {
      headers: { "x-forwarded-for": "9.9.9.9", "user-agent": "probe" },
    });

    expect(requestContext(request)).toEqual({ ip: "", userAgent: "probe" });
  });
});

describe("an IP behind a proxy the deployment declares", () => {
  beforeEach(() => {
    process.env.TRUST_PROXY_HEADERS = "true";
  });

  it("is the LAST hop, not the first", () => {
    // The first entries are whatever the caller sent; the proxy appended the
    // real one.
    expect(clientIpFrom(headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" }))).toBe(
      "203.0.113.7",
    );
    expect(
      clientIpFrom(headers({ "x-forwarded-for": "evil, 10.0.0.1, 203.0.113.7" })),
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, and to nothing", () => {
    expect(clientIpFrom(headers({ "x-real-ip": " 203.0.113.9 " }))).toBe("203.0.113.9");
    expect(clientIpFrom(headers({}))).toBe("");
    expect(clientIpFrom(headers({ "x-forwarded-for": " , , " }))).toBe("");
  });
});

describe("the throttles that used to key on it", () => {
  const controller = readFileSync(
    join(process.cwd(), "features/auth/server/auth.controller.ts"),
    "utf8",
  );

  it("budget the ACCOUNT, which a caller cannot rotate", () => {
    expect(controller).toContain("login:acct:${input.email.trim().toLowerCase()}");
    expect(controller).toContain("forgot:acct:${input.email.trim().toLowerCase()}");
  });

  it("only add an address bucket when the address is real", () => {
    // "" must never become a key: every visitor would share one bucket and a
    // stranger could lock the whole shop out of signing in.
    expect(controller).toContain("if (ctx.ip) rateLimit(`login:ip:${ctx.ip}`");
    expect(controller).toContain("if (ctx.ip) rateLimit(`forgot:ip:${ctx.ip}`");
    expect(controller).not.toContain("rateLimit(`login:${ctx.ip}`");
    expect(controller).not.toContain("rateLimit(`forgot:${ctx.ip}`");
  });

  it("still use the shop's own configured limit", () => {
    expect(controller).toContain("loginAttemptLimit(policy)");
  });
});

describe("the derivation is not duplicated", () => {
  it("maintenance mode uses the shared helper rather than its own copy", () => {
    const maintenance = readFileSync(
      join(process.cwd(), "features/settings/server/maintenance.server.ts"),
      "utf8",
    );

    // Two copies of a security rule is how one of them stayed wrong.
    expect(maintenance).toContain("clientIpFrom(await headers())");
    expect(maintenance).not.toContain('process.env.TRUST_PROXY_HEADERS === "true"');
  });
});
