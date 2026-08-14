import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BuilderRequestError,
  publishHomepage,
  saveHomepageDraft,
} from "@/features/cms-sections/data/homepage-sections-client";
import {
  BuilderRequestError as WeddingRequestError,
  saveWeddingDraftRequest,
} from "@/features/cms-sections/data/wedding-sections-client";

/**
 * A refused write has to say enough for the builder to recover.
 *
 * The route answers a stale save with `{ error, currentVersion }`. The client
 * threw a bare `Error` and dropped `currentVersion`, so the builder's version ref
 * stayed pinned at the number the conflict had just rejected — and every later
 * save in that tab conflicted too. The tab could never save again while still
 * holding work that existed nowhere else, which is worse than the overwrite the
 * version check was added to prevent.
 */

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("a write the server refused", () => {
  it("carries the version the store is on now", async () => {
    respond(409, { error: "This layout changed somewhere else…", currentVersion: 7 });

    const error = await saveHomepageDraft([], null, 3).catch((e) => e);

    expect(error).toBeInstanceOf(BuilderRequestError);
    expect(error.status).toBe(409);
    expect(error.currentVersion).toBe(7);
    expect(error.message).toMatch(/changed somewhere else/);
  });

  it("carries it on publish too", async () => {
    respond(409, { error: "conflict", currentVersion: 12 });

    const error = await publishHomepage([], 4).catch((e) => e);

    expect(error.currentVersion).toBe(12);
  });

  it("does the same on the wedding builder", async () => {
    respond(409, { error: "conflict", currentVersion: 2 });

    const error = await saveWeddingDraftRequest([], null, 1).catch((e) => e);

    expect(error).toBeInstanceOf(WeddingRequestError);
    expect(error.currentVersion).toBe(2);
  });

  it("still reports a plain failure with no version attached", async () => {
    respond(400, { error: "section 1: has no usable content object" });

    const error = await saveHomepageDraft([], null, 1).catch((e) => e);

    expect(error).toBeInstanceOf(BuilderRequestError);
    expect(error.status).toBe(400);
    expect(error.currentVersion).toBeUndefined();
    expect(error.message).toMatch(/content/);
  });

  it("does not invent a version from a malformed body", async () => {
    respond(409, { error: "conflict", currentVersion: "seven" });

    const error = await saveHomepageDraft([], null, 1).catch((e) => e);

    expect(error.currentVersion).toBeUndefined();
  });

  it("still describes a failure with no body at all", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>502</html>", { status: 502 })),
    );

    const error = await saveHomepageDraft([], null, 1).catch((e) => e);

    expect(error).toBeInstanceOf(BuilderRequestError);
    expect(error.status).toBe(502);
    expect(error.message).toMatch(/502/);
  });

  it("returns the new version on success so the next write can carry it", async () => {
    respond(200, { snapshot: { sections: [], updatedAt: "" }, version: 9 });

    expect((await saveHomepageDraft([], null, 8)).version).toBe(9);
  });
});
