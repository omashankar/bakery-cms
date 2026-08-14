/**
 * Customer admin meta (notes, tags, marketing opt-in) is a dual-write:
 * localStorage first so the UI is instant, then the server, which is the source
 * of truth. These pin the two rules that keep "saved" honest — a retry after a
 * rejected write must still reach the server, and a call that writes nothing
 * must not be reported as a save.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addCustomerTag,
  NOTHING_TO_WRITE,
  removeCustomerTag,
  updateCustomerNotes,
} from "@/apps/admin/commerce/lib/customers-repository";
import type { CustomerAdminMeta } from "@/types/customer";

function meta(overrides: Partial<CustomerAdminMeta> = {}): CustomerAdminMeta {
  return {
    email: "asha@example.com",
    notes: "",
    tags: [],
    marketingOptIn: false,
    ...overrides,
  } as CustomerAdminMeta;
}

/** Stub the dual-write endpoint with a fixed HTTP outcome. */
function mockServer(ok: boolean) {
  const fetchMock = vi.fn().mockResolvedValue({ ok } as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("customer meta writes", () => {
  it("reports persisted only when the server accepted the write", async () => {
    mockServer(true);
    await expect(addCustomerTag(meta(), "VIP")).resolves.toMatchObject({ persisted: true });

    mockServer(false); // e.g. an expired token 401
    await expect(addCustomerTag(meta(), "VIP")).resolves.toMatchObject({ persisted: false });

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(addCustomerTag(meta(), "VIP")).resolves.toMatchObject({ persisted: false });
  });

  it("still reaches the server when retrying a tag the local copy already shows", async () => {
    // The first attempt was rejected, so the local meta already carries the tag
    // while the server does not. Short-circuiting on `tags.includes` here would
    // return persisted:true without sending anything, and the page would toast
    // "Tag added" for a write that never left the browser.
    const fetchMock = mockServer(true);

    const result = await addCustomerTag(meta({ tags: ["VIP"] }), "VIP");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.persisted).toBe(true);
    expect(result.meta.tags).toEqual(["VIP"]);
    expect(result.skipped).toBeUndefined();
  });

  it("flags an empty tag as nothing written instead of claiming a save", async () => {
    const fetchMock = mockServer(true);

    const result = await addCustomerTag(meta(), "   ");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.skipped).toBe(NOTHING_TO_WRITE);
  });

  /**
   * Each write carries ONLY what it changed.
   *
   * This used to assert the opposite — that a notes write must carry the tags
   * and a tag write the notes — because the server `$set` everything it was
   * given, so a write that omitted a field wiped it. That made every save a
   * full snapshot composed from the caller's copy, which is precisely how two
   * admins on one customer overwrote each other: each carried the other's field
   * at its old value, and both were told it saved.
   *
   * Sending only the change makes the two edits independent, which is what the
   * snapshot was working around.
   */
  it("sends only the field it changed", async () => {
    const fetchMock = mockServer(true);
    const current = meta({ notes: "prefers evening delivery", tags: ["VIP", "wholesale"] });

    await updateCustomerNotes(current, "calls ahead");
    await removeCustomerTag(current, "VIP");

    const sent = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse((init as RequestInit).body as string)
    );

    expect(sent[0]).toEqual({ email: current.email, notes: "calls ahead" });
    expect(sent[1]).toEqual({ email: current.email, tags: ["wholesale"] });
  });

  it("still returns a complete record for the screen to render", () => {
    // The patch is what travels; the caller still needs something whole.
    const current = meta({ notes: "old", tags: ["VIP"] });
    mockServer(true);

    return updateCustomerNotes(current, "new").then(({ meta: saved }) => {
      expect(saved.notes).toBe("new");
      expect(saved.tags).toEqual(["VIP"]);
    });
  });
});
