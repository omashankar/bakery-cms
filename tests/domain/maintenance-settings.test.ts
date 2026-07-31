/**
 * Maintenance mode, which did not maintain anything.
 *
 * The switch is labelled "Toggle maintenance mode for the public website", the
 * save hint read "save changes to take the storefront offline", and the admin
 * overview said "storefront is paused". All of it was false: the only thing the
 * switch did was render a yellow strip above a fully working shop. A customer
 * could browse, fill a cart and complete checkout against a store the admin
 * believed they had closed.
 *
 * `allowedIps` was worse than unused — the page told the admin it would work "in
 * a future backend integration", so the field invited a list nobody honoured.
 *
 * The closure itself lives in server components and is verified against a
 * running server. What is pinned here is the part that is pure logic: who counts
 * as allowed, and what the section will accept.
 */
import { describe, expect, it } from "vitest";

import { maintenanceSchema } from "@/features/settings/server/settings.validators";
import {
  isValidIp,
  normalizeIp,
  parseAllowedIps,
} from "@/features/settings/lib/maintenance-access";
import { defaultMaintenanceSettings } from "@/features/settings/lib/settings-utils";

describe("matching a visitor against the allow-list", () => {
  // The canonical FORM is an implementation detail (it expands IPv6 rather than
  // compressing it). What has to hold is that two spellings of one address land
  // on the same string, so the assertions are written that way.
  it("ignores the port a proxy appends", () => {
    // `x-forwarded-for` routinely carries one. Comparing the raw string meant
    // the admin's own address never matched and they met the closed page.
    expect(normalizeIp("203.0.113.7:54321")).toBe(normalizeIp("203.0.113.7"));
    expect(normalizeIp("[2001:db8::1]:443")).toBe(normalizeIp("2001:db8::1"));
  });

  it("treats an IPv6-mapped IPv4 address as the same machine", () => {
    // A proxy may present 127.0.0.1 as ::ffff:127.0.0.1; an admin who typed the
    // familiar form would otherwise be locked out of their own shop.
    expect(normalizeIp("::ffff:127.0.0.1")).toBe("127.0.0.1");
    expect(normalizeIp("::FFFF:192.168.1.10")).toBe("192.168.1.10");
  });

  it("normalises case and whitespace, and survives an empty header", () => {
    expect(normalizeIp("  2001:DB8::1  ")).toBe(normalizeIp("2001:db8::1"));
    expect(normalizeIp("")).toBe("");
    expect(normalizeIp("   ")).toBe("");
    // Junk must normalise to "" rather than to itself, or two different
    // non-addresses could compare equal.
    expect(normalizeIp("localhost")).toBe("");
  });

  it("still distinguishes different addresses", () => {
    // The normaliser must not be so eager that it lets a stranger through.
    expect(normalizeIp("203.0.113.7")).not.toBe(normalizeIp("203.0.113.8"));
    expect(normalizeIp("[::1]:80")).not.toBe(normalizeIp("127.0.0.1"));
  });
});

describe("spellings of the SAME address must all match", () => {
  /**
   * The invariant the module exists to hold. A validator that accepts a form the
   * normaliser cannot canonicalise is worse than no validator: the entry saves
   * clean, the admin believes they have access, and they discover otherwise when
   * locked out of their own closed shop.
   */
  const SAME = [
    ["192.168.001.010", "192.168.1.10"],
    ["127.0.0.01", "127.0.0.1"],
    ["0:0:0:0:0:0:0:1", "::1"],
    ["2001:0db8:0000:0000:0000:0000:0000:0001", "2001:db8::1"],
    ["2001:DB8::1", "2001:db8:0:0:0:0:0:1"],
    ["::ffff:127.0.0.1", "127.0.0.1"],
    ["[::ffff:192.168.1.10]:8080", "192.168.1.10"],
  ];

  it.each(SAME)("treats %s and %s as one address", (a, b) => {
    expect(normalizeIp(a)).toBe(normalizeIp(b));
    expect(normalizeIp(a)).not.toBe("");
  });

  it("never collapses two DIFFERENT addresses into one", () => {
    const distinct = ["192.168.1.10", "192.168.1.11", "::1", "2001:db8::1", "10.0.0.1"];
    expect(new Set(distinct.map(normalizeIp)).size).toBe(distinct.length);
  });

  it("holds the invariant: anything valid canonicalises to something", () => {
    for (const [a, b] of SAME) {
      expect(isValidIp(a)).toBe(true);
      expect(isValidIp(b)).toBe(true);
    }
  });
});

describe("what counts as an address", () => {
  it("accepts real ones, in the forms an admin types", () => {
    expect(isValidIp("127.0.0.1")).toBe(true);
    expect(isValidIp("192.168.1.10")).toBe(true);
    expect(isValidIp("::1")).toBe(true);
    expect(isValidIp("2001:db8::1")).toBe(true);
    expect(isValidIp("203.0.113.7:8080")).toBe(true);
  });

  it("rejects what could never match a visitor", () => {
    // An entry that never matches is an admin believing they have access they
    // do not have — which they discover by being locked out mid-incident.
    expect(isValidIp("999.1.1.1")).toBe(false);
    expect(isValidIp("192.168.1")).toBe(false);
    expect(isValidIp("localhost")).toBe(false);
    expect(isValidIp("example.com")).toBe(false);
    expect(isValidIp("192.168.1.0/24")).toBe(false);
    expect(isValidIp("")).toBe(false);
  });

  it("rejects the near-miss shapes a loose IPv6 check used to wave through", () => {
    // These all LOOK plausible enough that an admin would not doubt them —
    // `1.2.3.4:80:90` in particular mimics the ported IPv4 form that is
    // supported — and none of them can ever equal a real client address.
    for (const junk of [":::", "::ffff:", "2001:db8::1:", "1:2:3:4:5:6:7:8:9", "1.2.3.4:80:90"]) {
      expect(isValidIp(junk), junk).toBe(false);
    }
  });

  it("splits the admin's comma-separated field, tolerating spacing", () => {
    expect(parseAllowedIps("127.0.0.1, ::1 ,  192.168.1.10 ")).toEqual([
      "127.0.0.1",
      "::1",
      "192.168.1.10",
    ]);
    expect(parseAllowedIps("")).toEqual([]);
    expect(parseAllowedIps(" , , ")).toEqual([]);
  });
});

describe("the maintenance section contract", () => {
  const base = { isEnabled: true, message: "Back shortly.", allowedIps: ["127.0.0.1"] };

  it("accepts the shipped defaults, so Reset works", () => {
    expect(maintenanceSchema.safeParse(defaultMaintenanceSettings).success).toBe(true);
  });

  it("refuses an empty visitor message", () => {
    // It is the entire content of the page a closed shop serves.
    expect(maintenanceSchema.safeParse({ ...base, message: "" }).success).toBe(false);
    expect(maintenanceSchema.safeParse({ ...base, message: "   " }).success).toBe(false);
  });

  it("refuses an allow-list entry that is not an address", () => {
    expect(maintenanceSchema.safeParse({ ...base, allowedIps: ["localhost"] }).success).toBe(false);
    expect(maintenanceSchema.safeParse({ ...base, allowedIps: ["192.168.1"] }).success).toBe(false);
    expect(maintenanceSchema.safeParse({ ...base, allowedIps: [] }).success).toBe(true);
  });

  it("ships with NOBODY on the allow-list", () => {
    // It used to ship `["127.0.0.1"]`, seeded into every fresh install. The
    // moment the list became a real access decision, that meant a guessable
    // address was pre-authorised on every deployment — and `x-forwarded-for` is
    // client-settable, so it was a one-header bypass of the whole feature.
    expect(defaultMaintenanceSettings.allowedIps).toEqual([]);
  });
});
