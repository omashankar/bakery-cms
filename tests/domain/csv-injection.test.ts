import { describe, expect, it } from "vitest";

import { escapeCsvCell, toCsv } from "@/utils/csv";

/**
 * Quoting a CSV cell stops it breaking the grammar. It does nothing about what a
 * spreadsheet DOES with the contents.
 *
 * Excel, Sheets and LibreOffice all read a cell starting with `=`, `+`, `-`,
 * `@`, a tab or a carriage return as a FORMULA. Most of what these exports hold
 * is typed by customers — delivery names, cities, addresses, order notes — so a
 * customer calling themselves `=HYPERLINK("http://evil","Refund status")` gets a
 * live, clickable formula in the shop's own spreadsheet, opened in the belief
 * that it is the shop's own data.
 *
 * Six exporters each had their own copy of the quoting, and every one was
 * injectable.
 */
describe("a CSV cell cannot become a formula", () => {
  it.each(["=", "+", "-", "@", "\t", "\r"])("neutralises a leading %j", (lead) => {
    const cell = escapeCsvCell(`${lead}HYPERLINK("http://evil","click")`);
    // The apostrophe is what tells a spreadsheet "this is text". It is not shown.
    expect(cell.startsWith(`"'${lead}`)).toBe(true);
  });

  it("neutralises the command-injection shape too", () => {
    expect(escapeCsvCell("=cmd|'/c calc'!A0").startsWith("\"'=")).toBe(true);
  });

  it("leaves ordinary text alone", () => {
    expect(escapeCsvCell("Priya Sharma")).toBe('"Priya Sharma"');
    expect(escapeCsvCell("12 MG Road, Bengaluru")).toBe('"12 MG Road, Bengaluru"');
    // A minus INSIDE the text is not a formula.
    expect(escapeCsvCell("Order BK-1042")).toBe('"Order BK-1042"');
  });

  it("still escapes quotes, so the grammar holds", () => {
    expect(escapeCsvCell('He said "hi"')).toBe('"He said ""hi"""');
  });

  it("renders null and undefined as empty, not as the words", () => {
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
  });

  it("builds a whole document row by row", () => {
    expect(toCsv([["a", "b"], ["=1+1", 2]])).toBe('"a","b"\n"\'=1+1","2"');
  });
});

describe("every exporter uses the shared serialiser", () => {
  const files = [
    "apps/admin/commerce/lib/customer-profile-utils.ts",
    "apps/admin/commerce/lib/order-utils.ts",
    "apps/admin/commerce/lib/invoice-utils.ts",
    "apps/admin/commerce/lib/payment-utils.ts",
    "apps/admin/commerce/lib/refund-utils.ts",
    "apps/admin/reports/lib/reports-data.ts",
  ];

  it.each(files)("%s", async (file) => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const source = readFileSync(path.join(process.cwd(), file), "utf8");

    expect(source).toContain("toCsv(");
    expect(source).toContain("downloadCsv(");
    // The hand-rolled quoting that was injectable in all six.
    expect(source).not.toContain("String(cell)");
  });
});
