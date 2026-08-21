import { describe, expect, it } from "vitest";

import { initialsFor } from "@/apps/admin/components/admin-header";

/**
 * The letters in the account menu when there is no photo to show.
 *
 * They used to be derived from the EMAIL and nothing else, so an admin called
 * "Om Suman" signing in as sumanom7014106@gmail.com was labelled "SU" — sitting
 * beside their own name in the same dropdown, while the profile screen one click
 * away derived "OS" from that name. Two surfaces, one person, two answers.
 *
 * Unit-tested rather than driven through the header: the profile screen hydrates
 * the real account from the server and fires its update event, so a seeded
 * photo-less profile is replaced before any browser assertion can read it. The
 * wiring is covered by tests/e2e/admin-avatar.spec.ts; this is the rule.
 */
describe("initials for the admin account menu", () => {
  it("takes the first letter of each of the first two names", () => {
    expect(initialsFor("Om Suman", "sumanom7014106@gmail.com")).toBe("OS");
  });

  it("uses one letter when the admin gave only one name", () => {
    expect(initialsFor("Om", "sumanom7014106@gmail.com")).toBe("O");
  });

  it("ignores names past the second", () => {
    expect(initialsFor("Om Kumar Suman", "x@y.com")).toBe("OK");
  });

  it("is not confused by stray whitespace", () => {
    expect(initialsFor("  Om   Suman  ", "x@y.com")).toBe("OS");
  });

  it("falls back to the email when no name has been set", () => {
    // A profile nobody has filled in has no name to use, and two letters from
    // the address still beat the "AU" placeholder.
    expect(initialsFor("", "sumanom7014106@gmail.com")).toBe("SU");
    expect(initialsFor("   ", "priya.sharma@example.com")).toBe("PS");
  });

  it("splits an email local part on dots, dashes and underscores", () => {
    expect(initialsFor("", "priya.sharma@example.com")).toBe("PS");
    expect(initialsFor("", "priya-sharma@example.com")).toBe("PS");
    expect(initialsFor("", "priya_sharma@example.com")).toBe("PS");
  });

  it("answers something rather than nothing when it has neither", () => {
    expect(initialsFor("", "")).toBe("AU");
  });

  it("prefers the name even when the email would give a different answer", () => {
    // The regression itself: both were available and the wrong one won.
    expect(initialsFor("Om Suman", "zz.qq@example.com")).toBe("OS");
  });
});
