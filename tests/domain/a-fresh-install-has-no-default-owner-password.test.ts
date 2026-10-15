import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A FRESH INSTALL HAS NO DEFAULT OWNER PASSWORD.
 *
 * `scripts/seed-admin.ts` created the owner with "Admin@12345" when
 * ADMIN_PASSWORD was unset, and under one developer's personal email when
 * ADMIN_EMAIL was — and only printed a warning. A new shop deployed that way
 * opened with an owner account anyone who had read the file could sign in to.
 * Comments may name the old values; the code must not use them.
 */
const code = readFileSync(join(process.cwd(), "scripts/seed-admin.ts"), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

describe("the owner seed", () => {
  it("falls back to no password and no email", () => {
    expect(code).not.toMatch(/ADMIN_PASSWORD\s*(\|\||\?\?)\s*["'`][^"'`]+["'`]/);
    expect(code).not.toMatch(/ADMIN_EMAIL\s*(\|\||\?\?)\s*["'`][^"'`]+["'`]/);
    expect(code).not.toContain("@gmail.com");
  });

  it("refuses to create the owner without an email and a real password", () => {
    expect(code).toContain('throw new Error("Set ADMIN_EMAIL');
    expect(code).toMatch(/password\.length < 10/);
    expect(code).toContain("Set ADMIN_PASSWORD");
  });
});
