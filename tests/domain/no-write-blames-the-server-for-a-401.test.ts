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
  const from = Math.max(
    0,
    head.lastIndexOf("function "),
    head.lastIndexOf("=> {"),
    head.lastIndexOf("async ("),
  );
  const body = masked.slice(from, toastAt);

  /**
   * The two shapes are NOT interchangeable, and treating them as one let a
   * guard in one branch vouch for every later toast in the same function.
   *
   * An early return is sound anywhere above: nothing after it runs unless the
   * session is fine. A WRAPPING guard protects only the call it wraps, so it
   * must be adjacent to THIS one — a handler with two failure branches had
   * its first branch's wrapper silently covering the second's.
   *
   * Plain string work rather than regexes: the escapes in this file have been
   * eaten twice by the tooling that edits it, leaving patterns that matched
   * nothing while still reading like a check.
   */
  const RETURNS = [
    "if (reportedAsSignedOut()) return",
    "if (reportedAsSignedOutOnRead()) return",
  ];
  const WRAPS = ["!reportedAsSignedOut())", "!reportedAsSignedOutOnRead())"];

  const earlyReturn = RETURNS.some((shape) => body.includes(shape));
  const before = masked.slice(Math.max(0, toastAt - 45), toastAt).trimEnd();
  const wrapsThisCall = WRAPS.some((shape) => before.endsWith(shape));

  return earlyReturn || wrapsThisCall;
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

    /**
     * EVERY root contributes, rather than a total with slack in it.
     *
     * `> 10` against 18 discovered sites let the walk lose nearly two fifths of
     * the tree and stay green — and a threshold tight enough to catch that is
     * a number someone must keep re-tuning, which is how it got loose in the
     * first place. Dropping a whole root is the failure that actually happens
     * (a rename, a broken recursion), and this notices it without a magic
     * number to maintain.
     */
    /**
     * Two separate questions, because they fail separately.
     *
     * Whether the walk still DESCENDS into each root, and whether the phrase
     * matching still finds anything. Requiring blaming messages from every root
     * conflated them and was simply false: `features/` carries none today, so
     * that check failed on a healthy tree while a dropped root passed.
     */
    /**
     * Named files, not the ROOTS constant.
     *
     * Iterating ROOTS cannot notice ROOTS shrinking — drop `features` and the
     * loop simply checks one fewer root and passes. So the check names actual
     * files the scan must reach: if a root stops being walked, its
     * representative goes missing and this says which one.
     */
    const MUST_REACH = [
      "apps/admin/commerce/pages/orders-list-page.tsx",
      "features/orders/lib/orders-api.ts",
    ];

    for (const path of MUST_REACH) {
      expect(FILES, `the walk no longer reaches ${path}`).toContain(path);
    }

    expect(checked.length, "the walk found almost no messages at all").toBeGreaterThan(10);
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

    /**
     * Counted across the WHOLE tree, not the two files named above.
     *
     * Filtering the hardcoded REPORTERS array meant the answer could only ever
     * be 0, 1 or 2 — so a third copy of the check, anywhere else, was
     * structurally invisible to the assertion whose entire job is to notice a
     * copy.
     */
    const declarations = sourceFilesUnder(ROOTS).filter((path) =>
      // Either declaration style. Matching only the `function` keyword let a
      // second copy written as a const arrow — the other style used
      // throughout this codebase — pass as no copy at all.
      /(?:function|const) reportedAsSignedOut/.test(
        mask(readFileSync(join(process.cwd(), path), "utf8")),
      ),
    );

    expect(declarations, "the check has been copied again").toHaveLength(1);
  });
});

describe("a READ that failed because the session ended", () => {
  it("is not reported with the write reporter's sentence", () => {
    /**
     * `reportedAsSignedOut` says "Not saved — …". That is right for a refused
     * write and wrong for a failed load: it was wired into "Could not load that
     * order" and two exports, so the only thing an admin was told about a
     * failed READ is that something had not been saved. Same question,
     * different sentence — `reportedAsSignedOutOnRead` says the other one.
     */
    const offenders: string[] = [];

    for (const path of sourceFilesUnder(ROOTS)) {
      if (REPORTERS.includes(path)) continue;
      const masked = mask(readFileSync(join(process.cwd(), path), "utf8"));

      let at = masked.indexOf("toast.error(");
      while (at > -1) {
        const args = toastArguments(masked, at);
        // A load, not a save. These are the ones whose guard must be the read
        // variant, because the write one narrates the wrong event.
        if (args && /could not load/i.test(args)) {
          const head = masked.slice(0, at);
          const from = Math.max(
            0,
            head.lastIndexOf("function "),
            head.lastIndexOf("=> {"),
            head.lastIndexOf("async ("),
          );
          const body = masked.slice(from, at);
          // Guarded by the WRITE reporter and not the read one.
          if (/reportedAsSignedOut\(\)/.test(body) && !/reportedAsSignedOutOnRead\(\)/.test(body)) {
            offenders.push(`${path} — ${masked.slice(at, at + 50).replace(/\s+/g, " ")}`);
          }
        }
        at = masked.indexOf("toast.error(", at + 1);
      }
    }

    expect(
      offenders,
      `these tell the admin nothing was SAVED when what failed was a load:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("has a read-side reporter to use", () => {
    const source = mask(readFileSync(join(process.cwd(), REPORTERS[0]), "utf8"));

    expect(source).toContain("export function reportedAsSignedOutOnRead");
    // And it handles both answers, like its write-side twin.
    const from = source.indexOf("function reportedAsSignedOutOnRead");
    const body = source.slice(from, source.indexOf("\n}", from));
    expect(body).toContain('"checking"');
    expect(body).toContain('"expired"');
  });
});
