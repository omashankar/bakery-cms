/**
 * What an admin is told when the session ends PART-WAY through a write.
 *
 * `reportedAsSignedOut()` says "Not saved". That is right for a single write
 * and false for one that got part of the way — and the backup restore is
 * exactly that: `restoreBackupToServer` pushes its sections one at a time, and
 * then replaces this browser's own stores (products, media, the page builders,
 * the security centre) from the backup regardless of how the pushes went.
 *
 * So a session ending after section three leaves three sections on the server,
 * six not, and the local half already overwritten. "Not saved" is false about
 * all three of those, and returning on it threw away the only list saying which
 * was which — on the one screen where an admin cannot check by eye.
 *
 * This test drives the reporter itself, because the wording IS the behaviour
 * here: there is nothing else to observe.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const toasts: Array<{ level: "error" | "success"; title: string; description?: string }> = [];

vi.mock("sonner", () => ({
  toast: {
    error: (title: string, options?: { description?: string }) => {
      toasts.push({ level: "error", title, description: options?.description });
    },
    success: (title: string, options?: { description?: string }) => {
      toasts.push({ level: "success", title, description: options?.description });
    },
  },
}));

const state = vi.hoisted(() => ({ current: "active" as string }));

vi.mock("@/features/auth/lib/session-expiry", () => ({
  sessionState: () => state.current,
}));

const { reportedAsSignedOut } = await import("@/apps/admin/lib/report-write");

/** What a restore interrupted after three of nine sections actually did. */
const HALF_DONE = {
  title: "Restored 3 of 9 sections to the server",
  detail:
    "delivery, seo, header, footer, appearance, commerce did not go, and this browser's own data (41 keys) was replaced from the backup either way.",
};

beforeEach(() => {
  toasts.length = 0;
  state.current = "active";
});

describe("a write the session ended half-way through", () => {
  it("says nothing at all while the session is fine", () => {
    expect(reportedAsSignedOut(HALF_DONE)).toBe(false);
    expect(toasts, "it spoke over a caller that had its own report to make").toEqual([]);
  });

  it("reports what landed, not 'Not saved'", () => {
    state.current = "expired";

    expect(reportedAsSignedOut(HALF_DONE)).toBe(true);
    expect(toasts).toHaveLength(1);

    const [said] = toasts;
    expect(said.title, "the counts were replaced by a blanket 'Not saved'").toBe(
      "Restored 3 of 9 sections to the server",
    );
    expect(said.title).not.toMatch(/not saved/i);

    // Which sections did not go, and that the local half happened anyway —
    // both are things the admin has no other way to learn.
    expect(said.description, "the list of what did not go was dropped").toContain("seo");
    expect(said.description, "the local overwrite went unmentioned").toContain(
      "replaced from the backup",
    );
  });

  it("still explains WHY, and what to do about it", () => {
    state.current = "expired";
    reportedAsSignedOut(HALF_DONE);

    // With the caller supplying the headline, the sentence about the session
    // has to move into the description — dropping it leaves a message that
    // explains nothing.
    expect(toasts[0]?.description, "the reason it stopped is gone").toMatch(/session had ended/i);
    expect(toasts[0]?.description, "no remedy offered").toMatch(/sign in again/i);
  });

  it("does not claim the session ended while that is still being asked", () => {
    state.current = "checking";
    reportedAsSignedOut(HALF_DONE);

    // A 401 asks the server rather than declaring, and that answer takes a
    // round trip this reporter does not wait for. Saying "your session had
    // ended" here is a verdict this moment cannot support.
    expect(toasts[0]?.description).not.toMatch(/session had ended/i);
    expect(toasts[0]?.description).toMatch(/checking whether you are still signed in/i);
    expect(toasts[0]?.title, "the counts were dropped on this path instead").toBe(
      "Restored 3 of 9 sections to the server",
    );
  });

  it("keeps the plain wording for callers with nothing to add", () => {
    // The other eleven screens pass nothing, and "Not saved" is the correct
    // sentence for them. Widening the signature must not have changed it.
    state.current = "expired";
    expect(reportedAsSignedOut()).toBe(true);

    expect(toasts[0]?.title).toBe("Not saved — your session had ended");
    expect(toasts[0]?.description).toBe("Sign in again in the dialog, then try once more.");
  });
});

describe("the restore that needed this", () => {
  it("hands the reporter its counts rather than the bare check", async () => {
    /**
     * Structural, because the wiring is what regressed.
     *
     * `reportedAsSignedOut()` and `reportedAsSignedOut({…})` are the same call
     * to every other check in this repo — the 401 guard test accepts both, and
     * must, since the rule it enforces is about blaming the server. Nothing
     * else would notice this screen quietly going back to "Not saved".
     */
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const page = readFileSync(
      join(process.cwd(), "apps/admin/settings/components/backup-settings-page.tsx"),
      "utf8",
    );

    const at = page.indexOf("reportedAsSignedOut(");
    expect(at, "the restore no longer asks whether the session ended").toBeGreaterThan(-1);

    const call = page.slice(at, page.indexOf("})", at));
    expect(call, "the restore is back to a bare 'Not saved'").toContain("title:");
    expect(call, "how many sections landed is not passed").toContain("serverSections.length");
    expect(call, "which sections did not go is not passed").toContain("failedSections.join");
    expect(call, "the local overwrite is not mentioned").toContain("localCount");
  });
});
