/**
 * Optimistic concurrency for the page builders.
 *
 * Both builders are replace-all: the client PUTs the entire section array it has
 * in memory. Nothing compared that array against what was on the server, so a
 * second admin — or a second tab, or the same tab left open over lunch — silently
 * replaced everything done since it loaded. Both people saw a green "draft
 * saved". Publish was worse: it wrote the stale array to `published` as well, so
 * the storefront went back in time and the other admin's saved draft went with
 * it.
 *
 * The same shape the refund path in this repo already uses: carry the version you
 * read, refuse the write if it moved, and tell the caller what it is now.
 */

/** A write's result, with the version the caller must carry into its next one. */
export interface VersionedSnapshot<TSnapshot> {
  snapshot: TSnapshot;
  version: number;
}

export class BuilderConflictError extends Error {
  readonly currentVersion: number;

  constructor(currentVersion: number) {
    super(
      "This layout was changed somewhere else after you opened it. Reload to see the current version before saving.",
    );
    this.name = "BuilderConflictError";
    this.currentVersion = currentVersion;
  }
}

/** Documents written before versioning read as 0. */
export function versionOf(state: { version?: number } | null | undefined): number {
  return state?.version ?? 0;
}

/** Every write moves the counter — a write that did not would be invisible. */
export function nextVersion(state: { version?: number } | null | undefined): number {
  return versionOf(state) + 1;
}

/**
 * Throws unless the caller composed its payload against the state on disk.
 *
 * `expected` USED to be optional, "so a caller with nothing to compare … is not
 * forced to invent one — but the two writes that carry a client-held array
 * always pass it". They did not, and that sentence was the bug.
 *
 * The builder holds `versionRef.current === undefined` until its opening
 * `fetchHomepageState()` resolves — and forever, if that fetch THREW, because
 * the failure path only toasts. In both windows the section list in memory is
 * still `[]` and Publish was live, so an early-undefined sailed straight through
 * this check and published an empty array over the live storefront homepage.
 * Nothing on screen hinted at it: the confirm dialog says only "This updates the
 * live /store homepage for everyone" and never names a section count. The same
 * path existed for /store/wedding-cakes.
 *
 * A caller that cannot say which version it edited has not read the document,
 * and a replace-all write from something that has not read is not a save, it is
 * a deletion. It is refused with the same conflict a stale version gets, because
 * "reload before saving" is the right instruction for both.
 *
 * There is no permissive variant, because nothing needs one: the two paths that
 * were supposed to want it — `restoreHomepageRevision` and
 * `resetHomepageSections` — re-read inside `store.mutate` and never call this at
 * all.
 */
export function assertVersion(
  state: { version?: number } | null | undefined,
  expected: number | undefined,
): void {
  const current = versionOf(state);
  if (expected === undefined) throw new BuilderConflictError(current);
  if (current !== expected) throw new BuilderConflictError(current);
}
