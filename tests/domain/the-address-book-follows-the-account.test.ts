// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * THE ADDRESS BOOK FOLLOWS THE ACCOUNT, NOT THE DEVICE.
 *
 * It lived only in one browser's localStorage: an address saved on a phone
 * was missing at checkout on the laptop, and clearing site data lost all of
 * it. The account keeps it now; the device copy is a cache the screens read
 * synchronously. These pin the rules that keep the two in step without one
 * silently eating the other's changes.
 */

const signedIn = { value: true };
vi.mock("@/apps/website/account/lib/customer-session", () => ({
  hasCustomerSession: () => signedIn.value,
}));

const { savedAddressesSchema } = await import(
  "@/features/customer-auth/server/customer-auth.validators"
);
const book = await import("@/apps/website/account/lib/customer-addresses");

const KEY = "bakery-cms-customer-addresses";

function address(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    label: "Home",
    isDefault: false,
    createdAt: "2026-10-13T00:00:00.000Z",
    updatedAt: "2026-10-13T00:00:00.000Z",
    fullName: `Customer ${id}`,
    email: "c@example.com",
    phone: "9876543210",
    addressLine1: "C-7 Santosh Nagar",
    city: "Kota",
    state: "Rajasthan",
    pincode: "324002",
    country: "India",
    ...extra,
  };
}

type Call = { method: string; body: unknown };
let calls: Call[] = [];
let serverBook: { addresses: unknown[]; savedAt: string | null } = { addresses: [], savedAt: null };
let putOk = true;

beforeEach(() => {
  localStorage.clear();
  signedIn.value = true;
  calls = [];
  serverBook = { addresses: [], savedAt: null };
  putOk = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ method, body });
      if (method === "PUT") {
        if (!putOk) return new Response("{}", { status: 503 });
        serverBook = { addresses: body.addresses, savedAt: new Date().toISOString() };
        return Response.json({ success: true, data: body.addresses });
      }
      return Response.json({ success: true, data: serverBook });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("what the endpoint will store", () => {
  it("drops fields the book does not have, and caps the book at twenty", () => {
    const parsed = savedAddressesSchema.parse({
      addresses: [{ ...address("a"), isAdmin: true, notes: "<script>" }],
    });
    expect(parsed.addresses[0]).not.toHaveProperty("isAdmin");
    expect(parsed.addresses[0]).not.toHaveProperty("notes");

    const many = Array.from({ length: 21 }, (_, i) => address(String(i)));
    expect(savedAddressesSchema.safeParse({ addresses: many }).success).toBe(false);
  });
});

describe("keeping the device and the account in step", () => {
  it("sends a save to the account as well as the device", async () => {
    book.createSavedAddress({ ...address("x"), isDefault: true });
    await book.syncSavedAddresses(); // waits for the queued write

    const put = calls.find((call) => call.method === "PUT");
    expect(put, "nothing reached the account").toBeTruthy();
    expect((put!.body as { addresses: unknown[] }).addresses).toHaveLength(1);
  });

  it("keeps a guest's book on the device only", async () => {
    signedIn.value = false;
    book.createSavedAddress({ ...address("x"), isDefault: true });

    expect(await book.syncSavedAddresses()).toBeNull();
    expect(calls).toEqual([]);
    expect(book.getSavedAddresses()).toHaveLength(1);
  });

  it("brings the account's book to a device that does not have it", async () => {
    serverBook = { addresses: [address("phone", { isDefault: true })], savedAt: "2026-10-12T00:00:00.000Z" };

    const synced = await book.syncSavedAddresses();

    expect(synced?.map((entry) => entry.id)).toEqual(["phone"]);
    expect(JSON.parse(localStorage.getItem(KEY) ?? "[]")).toHaveLength(1);
    expect(calls.some((call) => call.method === "PUT"), "the pulled book was sent back").toBe(false);
  });

  it("lets an EMPTIED account book win over an old device copy", async () => {
    // Deleted on the phone; the laptop still holds the old list.
    localStorage.setItem(KEY, JSON.stringify([address("old", { isDefault: true })]));
    serverBook = { addresses: [], savedAt: "2026-10-12T00:00:00.000Z" };

    const synced = await book.syncSavedAddresses();

    expect(synced).toEqual([]);
    expect(calls.some((call) => call.method === "PUT"), "deleted addresses came back").toBe(false);
  });

  it("uploads this device's book once, to an account that never had one", async () => {
    localStorage.setItem(KEY, JSON.stringify([address("before", { isDefault: true })]));

    await book.syncSavedAddresses();

    const put = calls.find((call) => call.method === "PUT");
    expect((put?.body as { addresses: { id: string }[] } | undefined)?.addresses.map((a) => a.id)).toEqual([
      "before",
    ]);
  });

  it("does not let the account's older list overwrite a save that never arrived", async () => {
    serverBook = { addresses: [address("server")], savedAt: "2026-10-12T00:00:00.000Z" };
    putOk = false;
    book.createSavedAddress({ ...address("offline"), isDefault: true });
    await book.syncSavedAddresses().catch(() => undefined);

    // The device still has the offline save, and the next sync PUSHES it.
    putOk = true;
    calls = [];
    await book.syncSavedAddresses();

    expect(calls[0]?.method).toBe("PUT");
    // `createSavedAddress` mints its own id, so the entry is known by its name.
    expect(book.getSavedAddresses().map((entry) => entry.fullName)).toEqual(["Customer offline"]);
    expect(localStorage.getItem(book.ADDRESSES_DIRTY_KEY)).toBeNull();
  });
});
