/**
 * CSV serialisation for the admin's exports.
 *
 * Six screens each had their own copy of `row.map(cell => '"' + ... + '"')`, and
 * every one of them was injectable. Quoting a cell stops it breaking the CSV
 * grammar; it does nothing about what a spreadsheet DOES with the contents.
 *
 * Excel, Google Sheets and LibreOffice all treat a cell whose first character is
 * `=`, `+`, `-`, `@`, a tab or a carriage return as a FORMULA. Most of what these
 * exports contain is typed by customers — delivery names, cities, addresses,
 * order notes, review bodies — so a customer calling themselves
 * `=HYPERLINK("http://evil","Refund status")` gets a live, clickable formula in
 * the shop's own spreadsheet, and `=cmd|'/c calc'!A0` is the same trick aimed at
 * the machine. The shop opens the file believing it is looking at its own data.
 *
 * Prefixing with an apostrophe is the standard defence: spreadsheets read it as
 * "this is text", and it is not displayed.
 */

/** Characters a spreadsheet reads as "a formula follows". */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = FORMULA_LEAD.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** A whole CSV document from a header row and its data rows. */
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
}

/**
 * Hand the file to the browser.
 *
 * The object URL is revoked on the next tick rather than immediately: revoking
 * in the same statement as `click()` races the download in some browsers, and
 * the failure is a silently empty file.
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === "undefined") return;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
