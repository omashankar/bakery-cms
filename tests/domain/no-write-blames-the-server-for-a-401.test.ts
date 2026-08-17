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

/** Phrases that blame the server, or claim the change survived locally. */
const BLAMES_THE_SERVER =
  /on this device only|server rejected|server refused|did not reach the server|was not saved|not saved/i;

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

function blamingToasts(file: string): Site[] {
  const raw = readFileSync(join(process.cwd(), file), "utf8");
  const masked = mask(raw);
  const sites: Site[] = [];

  const re = /toast\.error\(([\s\S]{0,240}?)\)\s*;/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(masked))) {
    if (!BLAMES_THE_SERVER.test(match[1])) continue;
    // The guard immediately in front of it, as `if (!reportedAsSignedOut()) `.
    const before = raw.slice(Math.max(0, match.index - 40), match.index);
    sites.push({
      file,
      text: raw.slice(match.index, match.index + 60).replace(/\s+/g, " "),
      guarded: /reportedAsSignedOut\(\)\)\s*$/.test(before),
    });
  }

  return sites;
}

describe("an admin write that the server refused", () => {
  const FILES = sourceFilesUnder(ROOTS).filter((file) => !REPORTERS.includes(file));

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
