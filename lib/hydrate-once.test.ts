/**
 * Two callers must cost one request.
 *
 * The point of this helper is to let a page start its own hydration instead of
 * waiting for the admin layout's deferred batch. That is only an improvement if
 * the layout's later call is free — otherwise every such page would fetch its
 * data twice, and the second read would overwrite the cache the admin is already
 * looking at.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hydrateOnce, resetHydrateOnce } from "./hydrate-once";

/** A hydration that resolves when the test says so. */
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

beforeEach(() => {
  resetHydrateOnce();
});

describe("hydrateOnce", () => {
  it("runs the hydration", async () => {
    const run = vi.fn(async () => undefined);

    await hydrateOnce("reviews", run);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("makes a second caller join the first rather than repeat it", async () => {
    // THE case: the page asks, and the layout's deferred batch asks a second
    // later while the first read is still open.
    const slow = deferred();
    const run = vi.fn(() => slow.promise);

    const first = hydrateOnce("reviews", run);
    const second = hydrateOnce("reviews", run);

    expect(run, "the second caller started its own fetch").toHaveBeenCalledTimes(1);

    slow.release();
    await Promise.all([first, second]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does nothing once it has already succeeded", async () => {
    const run = vi.fn(async () => undefined);

    await hydrateOnce("reviews", run);
    await hydrateOnce("reviews", run);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it("lets a later screen retry after a failed read", async () => {
    // A failure is not remembered: the admin who navigates on should get a real
    // attempt, not the offline moment cached for the session.
    const run = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(undefined);

    await hydrateOnce("reviews", run);
    await hydrateOnce("reviews", run);

    expect(run).toHaveBeenCalledTimes(2);
  });

  it("never rejects, because every caller is a fire-and-forget effect", async () => {
    const run = vi.fn(async () => {
      throw new Error("offline");
    });

    await expect(hydrateOnce("reviews", run)).resolves.toBeUndefined();
  });

  it("keeps different caches apart", async () => {
    const reviews = vi.fn(async () => undefined);
    const media = vi.fn(async () => undefined);

    await Promise.all([hydrateOnce("reviews", reviews), hydrateOnce("media", media)]);

    expect(reviews).toHaveBeenCalledTimes(1);
    expect(media).toHaveBeenCalledTimes(1);
  });
});
