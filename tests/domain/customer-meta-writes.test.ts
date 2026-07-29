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

  it("composes every write from the meta it is handed, not a cached copy", async () => {
    const fetchMock = mockServer(true);
    const current = meta({ notes: "prefers evening delivery", tags: ["VIP", "wholesale"] });

    await updateCustomerNotes(current, "calls ahead");
    await removeCustomerTag(current, "VIP");

    const sent = fetchMock.mock.calls.map(([, init]) =>
      JSON.parse((init as RequestInit).body as string)
    );

    // The notes write must carry the existing tags, and the tag write the
    // existing notes — otherwise each one silently reverts the other.
    expect(sent[0]).toMatchObject({ notes: "calls ahead", tags: ["VIP", "wholesale"] });
    expect(sent[1]).toMatchObject({ notes: "prefers evening delivery", tags: ["wholesale"] });
  });
});
