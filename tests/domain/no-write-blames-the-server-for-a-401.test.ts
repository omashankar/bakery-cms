import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * "The server rejected it" is a claim about the VALUE. A 401 is a statement
 * about WHO was asking, and the two need opposite responses from the admin:
 * fix the input, or sign in again.
 *
 * The session-expiry work put that check into the two shared reporters — and
 * missed that most admin writes never call them. Fifteen screens build their
 * own `toast.error` with wording tuned to what they just did (a stock
 * adjustment, a refund, a template, a profile photo), and every one told the
 * admin the server had rejected a write the server had merely not recognised —
 * then invited a reload, which discards the unsaved edits the sign-in dialog
 * promises are safe.
 *
 * DISCOVERED, not listed. Four rounds of this bug came from hand-written
 * inventories that cannot notice what is missing from themselves, so this walks
 * the admin tree and holds every write-failure message it finds to the same
 * rule — including ones written after this test.
 */

const ROOTS = ["apps/admin", "features"];

/**
 * Messages that name a CAUSE, and would name the wrong one on a 401.
 *
 * The line is deliberately here and not wider. "Could not load pages" is
 * accurate when a 401 stopped the load — unhelpful, but not false — so
 * demanding a guard for it would be noise. What must not survive is a message
 * that attributes the failure: to the server's judgement of the VALUE ("the
 * server rejected it"), to the network ("check your connection"), or to a
 * state it cannot know ("it is still active"). Each of those sends an admin
 * somewhere there is nothing to find, and none of them is what happened.
 */
const BLAMES_THE_SERVER =
  /on this device only|server (rejected|refused|did not answer)|did not reach the server|check your connection|was not accepted|it is still active|they are still signed in|was not saved|not saved/i;

/**
 * Surfaces with no admin session to end, so no guard to apply.
 *
 * The auth pages run before anyone is signed in — a 401 there is the answer,
 * not a interruption — and the storefront belongs to shoppers. The session
 * dialog's own "could not reach the server" is the honest report of exactly
 * the case it names.
 */
const NO_ADMIN_SESSION = [
  "features/auth/pages/",
  "features/auth/components/session-guard.tsx",
  "features/cms-sections/homepage-section-renderer.tsx",
];

/**
 * Comments MASKED rather than removed, so offsets still index the real file.
 *
 * These files discuss the very phrases being matched — several carry a
 * paragraph explaining why the wording matters — and a scan that counted the
 * explanation would report a guard where there is none, or miss one there is.
 */
const mask = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));

function sourceFilesUnder(roots: string[]): string[] {
  const found: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        walk(path);
      } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
        found.push(path);
      }
    }
  };

  for (const root of roots) walk(root);
  return found.sort();
}

/**
 * The two reporters are where the check LIVES, so they are held to a different
 * rule (below) rather than exempted from having one.
 */
const REPORTERS = ["apps/admin/lib/report-write.ts", "apps/admin/settings/lib/report-settings-write.ts"];

interface Site {
  file: string;
  text: string;
  guarded: boolean;
}

/**
 * The arguments of one `toast.error(...)` call, bounded by its own closing
 * parenthesis rather than by a character count.
 *
 * The first version stopped the lazy match at 240 characters, so any longer
 * call was not reported as unguarded — it was never SEEN. That was not
 * hypothetical: the restore report in backup-settings-page.tsx is 514
 * characters, and it sat unguarded in a green suite, telling admins "the
 * server refused" for sections refused because the session had ended. A scan
 * that silently drops what it cannot fit is worse than no scan, because it
 * reads as coverage.
 */
function toastArguments(masked: string, from: number): string | null {
  const open = masked.indexOf("(", from);
  if (open < 0) return null;

  let depth = 0;
  for (let at = open; at < masked.length; at += 1) {
    const ch = masked[at];
    if (ch === "(") depth += 1;
    else if (ch === ")") {
      depth -= 1;
      if (depth === 0) return masked.slice(open + 1, at);
    }
  }
  return null;
}

/**
 * Whether the check runs before this toast, in either shape the codebase uses.
 *
 * Two are correct and both appear: wrapping the call —
 * `if (!reportedAsSignedOut()) toast.error(…)` — and returning early at the top
 * of the handler, `if (reportedAsSignedOut()) return;`. An earlier version
 * matched only a 40-character window immediately before the call, so every
 * early-return site read as unguarded; the one place that used it was a real
 * defect, which masked the fact that the shape was unsupported at all.
 *
 * Scoped to the ENCLOSING FUNCTION. A guard in the function above is not this
 * function's guard, and searching the whole file for one is how the sibling
 * check went green for an unguarded reporter.
 *
 * Read from the MASKED source, like the position it is measured from: reading
 * the raw text was the one place comments were not masked, so a comment
 * mentioning the check could pass as the check.
 */
function guardPrecedes(masked: string, toastAt: number): boolean {
  const head = masked.slice(0, toastAt);
  // The nearest thing that opens a function body above this call.
  const starts = [
    head.lastIndexOf("function "),
    head.lastIndexOf("=> {"),
    head.lastIndexOf("async ("),
  ];
  const from = Math.max(0, ...starts);
  const body = masked.slice(from, toastAt);

  // `!` for the wrapping shape; a bare call is the early-return shape, which
  // only counts when it is actually acted on.
  return (
    /!\s*reportedAsSignedOut\(\)/.test(body) ||
    /if \(reportedAsSignedOut\(\)\)\s*return/.test(body)
  );
}

function blamingToasts(file: string): Site[] {
  const raw = readFileSync(join(process.cwd(), file), "utf8");
  const masked = mask(raw);
  const sites: Site[] = [];

  let at = masked.indexOf("toast.error(");
  while (at > -1) {
    const args = toastArguments(masked, at);
    if (args && BLAMES_THE_SERVER.test(args)) {
      sites.push({
        file,
        text: raw.slice(at, at + 60).replace(/\s+/g, " "),
        guarded: guardPrecedes(masked, at),
      });
    }
    at = masked.indexOf("toast.error(", at + 1);
  }

  return sites;
}

describe("an admin write that the server refused", () => {
  const FILES = sourceFilesUnder(ROOTS).filter(
    (file) =>
      !REPORTERS.includes(file) && !NO_ADMIN_SESSION.some((exempt) => file.startsWith(exempt)),
  );

  it("never blames the server without first asking who was asking", () => {
    const unguarded = FILES.flatMap(blamingToasts)
      .filter((site) => !site.guarded)
      .map((site) => `${site.file} — ${site.text}`);

    expect(
      unguarded,
      `these tell the admin the server rejected a write that may have been refused ` +
        `because their session ended:\n  ${unguarded.join("\n  ")}`,
    ).toEqual([]);
  });

  it("found some to check, so an empty pass cannot look like a clean one", () => {
    const checked = FILES.flatMap(blamingToasts);

    expect(
      checked.length,
      "no write-failure messages found at all — has the walk broken?",
    ).toBeGreaterThan(10);
  });

  it("keeps the check itself in one place", () => {
    /**
     * There were two copies, and they drifted: the shared one learned about the
     * "checking" state and the settings twin did not, so every settings screen
     * went on saying "the server rejected it" for a write the server had not
     * seen. A second implementation is the bug, not a detail.
     */
    for (const path of REPORTERS) {
      const source = mask(readFileSync(join(process.cwd(), path), "utf8"));
      const declares = /function reportedAsSignedOut/.test(source);
      const imports = /import \{[^}]*reportedAsSignedOut/.test(source);

      expect(
        declares || imports,
        `${path} does not consult the signed-out check at all`,
      ).toBe(true);
    }

    const declarations = REPORTERS.filter((path) =>
      /function reportedAsSignedOut/.test(mask(readFileSync(join(process.cwd(), path), "utf8"))),
    );

    expect(declarations, "the check has been copied again").toHaveLength(1);
  });
});
