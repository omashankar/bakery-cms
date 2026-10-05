import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Two settings screens were describing themselves wrongly, in the two
 * directions that matter most.
 *
 * The mail screen told the shop it was a demo. "Stored locally for demo
 * purposes. Connect a real provider in production." Both halves false: the
 * values are written to the database, the password is kept server-side and
 * redacted on read — which the hint under that very field says out loud — and
 * "Send test email" sends a real message. A shop reading "demo" has every
 * reason to stop filling it in, and then no order confirmation, no sign-in code
 * and no password reset ever leaves.
 *
 * The backup screen told the shop the opposite. Its two buttons that push a
 * whole backup over the live database wore the warm primary — the same button
 * an owner presses to Save on every other screen — while the one button that
 * merely drops a row from a list was red. And neither restore dialog said that
 * a restore REMOVES: delivery zones, coupons and both template sets are written
 * back with the ids the backup holds, so any row it does not hold is deleted.
 * Somebody restoring last month's file to undo one edit loses every coupon and
 * zone made since.
 *
 * The pattern under both: a screen whose words were written once and never
 * measured against what the code does.
 */

const SMTP = "apps/admin/settings/components/smtp-settings-page.tsx";
const BACKUP = "apps/admin/settings/components/backup-settings-page.tsx";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

describe("the mail screen stops calling itself a demo", () => {
  const smtp = code(SMTP);

  it("says neither of the two false things", () => {
    expect(smtp).not.toContain("Stored locally for demo purposes");
    expect(smtp).not.toContain("Connect a real provider in production");
  });

  it("says what actually stops when it is left blank", () => {
    // The three the transport carries. Naming them is what makes a half-filled
    // screen read as unfinished rather than as optional.
    expect(smtp).toContain("Order confirmations, sign-in");
    expect(smtp).toContain("codes and password resets all go out through it");
  });

  it("stops promising a newsletter it has no path for", () => {
    expect(smtp).not.toContain("inquiry notifications and newsletters");
  });

  it("gives every jargon field a line in the shop's words", () => {
    /**
     * Seven boxes of pure protocol with nothing under any of them. The shop is
     * not being taught SMTP here — each line answers the only question it
     * actually has, which is where the value comes from.
     */
    expect(smtp).toContain("From your email provider. It usually starts with smtp.");
    expect(smtp).toContain("Usually the full email address of the account");
    expect(smtp).toContain("Most providers refuse to");
  });

  it("puts the two fields that must agree beside each other", () => {
    /**
     * Port was second and Encryption last, across a full-width row at the
     * bottom — the two cells furthest apart on the card, for one decision.
     * Split up, a shop pairs 587 with SSL and the send fails on a timeout that
     * names neither.
     */
    const port = smtp.indexOf('htmlFor="port"');
    const encryption = smtp.indexOf('htmlFor="encryption"');

    expect(port).toBeGreaterThan(0);
    expect(encryption).toBeGreaterThan(port);
    // Close enough to be read as one thing: the old layout had four fields and
    // a full-width row between them.
    expect(smtp.slice(port, encryption)).not.toContain('htmlFor="username"');
    expect(smtp).toContain("Port 587 with TLS, or port 465 with SSL");
  });
});

describe("the backup screen says what a restore takes away", () => {
  const backup = code(BACKUP);

  it("names the rows a restore removes, in both dialogs", () => {
    const mentions = backup.split("coupons, delivery zones, email and WhatsApp templates").length - 1;
    expect(mentions, "both the import and the restore dialog must say it").toBe(2);
  });

  it("stops describing the write as a push and an overwrite", () => {
    // True, and useless: it describes the mechanism and not the loss.
    expect(backup).not.toContain("Export current data first if you need a rollback");
  });

  it("says outright that a history restore has no way back", () => {
    /**
     * Import archives a snapshot first and refuses if it comes back incomplete.
     * This path writes straight through. The two dialogs stated that as a
     * difference of TONE — "a snapshot is archived first" against "export first
     * if you need a rollback" — which reads as advice, not as the absence of the
     * safety net the other one has.
     */
    expect(backup).toContain("No snapshot is taken first");
    expect(backup).toContain("there is nothing to");
    // …and the path that DOES take one still says so.
    expect(backup).toContain("A snapshot of your current data is archived first");
  });
});

describe("the colours on the backup screen point the right way", () => {
  const backup = code(BACKUP);

  it("stops dressing a database overwrite as Save", () => {
    /**
     * `variant="bakery"` is the warm primary — the Save button everywhere else
     * in this admin. It was on both buttons that replace the shop's live data.
     */
    const importAt = backup.indexOf("onClick={confirmImport}");
    const restoreAt = backup.indexOf("onClick={confirmRestore}");

    for (const [name, at] of [["import", importAt], ["restore", restoreAt]] as const) {
      expect(at, `${name} button not found`).toBeGreaterThan(0);
      const button = backup.slice(backup.lastIndexOf("<Button", at), at);
      expect(button, `${name} still looks like Save`).toContain('variant="destructive"');
    }
  });

  it("stops shouting on the one action that changes nothing", () => {
    // It drops a row from a list. The downloaded file is untouched, and so is
    // the shop.
    const at = backup.indexOf("onClick={confirmDelete}");
    expect(at).toBeGreaterThan(0);
    expect(backup.slice(backup.lastIndexOf("<Button", at), at)).toContain('variant="outline"');
    expect(backup).toContain("Nothing in");
    expect(backup).toContain("your shop changes");
  });

  it("names the button after what it does, not after the screen", () => {
    // "Import backup" and "Restore snapshot" describe the file. "Replace my
    // data" describes what happens to the shop.
    expect(backup.split("Replace my data").length - 1).toBe(2);
  });
});
