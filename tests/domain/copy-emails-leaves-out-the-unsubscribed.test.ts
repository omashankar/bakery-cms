import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * "COPY EMAILS" COPIED WHATEVER THE FILTER SHOWED, AND IT DEFAULTS TO "ALL".
 *
 * It is the newsletter screen's only export, and it is used to fill a mailing.
 * An address deactivated because its owner asked to be removed went straight
 * back into the next campaign unless the admin remembered to filter first.
 *
 * Scoped to the handler: the clipboard must receive the ACTIVE rows.
 */
const source = readFileSync(
  join(process.cwd(), "apps/admin/inquiries/components/newsletter-subscribers-page.tsx"),
  "utf8",
);
const start = source.indexOf("async function copyEmails()");
const body = source.slice(start, source.indexOf("\n  }\n", start));

describe("Copy emails", () => {
  it("copies only active subscribers, whatever the filter shows", () => {
    expect(start).toBeGreaterThan(-1);
    expect(body).toMatch(/const active = filtered\.filter\(\(item\) => item\.isActive\)/);
    expect(body).toMatch(/const emails = active\.map\(/);
    expect(body).not.toMatch(/const emails = filtered\.map\(/);
  });
});
