/**
 * Saved addresses at checkout.
 *
 * The address book already existed and the account page managed it, but
 * checkout never read it — so a customer retyped an address we already had on
 * every order. These pin the behaviour the checkout now depends on.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  createSavedAddress,
  deleteSavedAddress,
  getDefaultAddress,
  getSavedAddresses,
  setDefaultSavedAddress,
  updateSavedAddress,
} from "@/apps/website/account/lib/customer-addresses";

function input(overrides: Partial<Parameters<typeof createSavedAddress>[0]> = {}) {
  return {
    label: "Home",
    fullName: "Asha",
    email: "asha@example.com",
    phone: "+919999999999",
    addressLine1: "1 Baker Street",
    addressLine2: "",
    city: "Mumbai",
    state: "MH",
    pincode: "400001",
    isDefault: false,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("an empty address book", () => {
  it("has no default to preselect", () => {
    expect(getSavedAddresses()).toHaveLength(0);
    expect(getDefaultAddress()).toBeNull();
  });
});

describe("the first saved address becomes the default", () => {
  it("is marked default even when not requested", () => {
    const created = createSavedAddress(input({ isDefault: false }));

    expect(created.isDefault).toBe(true);
    expect(getDefaultAddress()?.id).toBe(created.id);
  });
});

describe("checkout preselects the right address", () => {
  it("returns the explicitly-default address, not merely the newest", () => {
    const home = createSavedAddress(input({ label: "Home" }));
    createSavedAddress(input({ label: "Office", addressLine1: "2 Work Road" }));

    // Home was created first and is default; Office is newer.
    expect(getDefaultAddress()?.id).toBe(home.id);
  });

  it("follows the default when it moves", () => {
    createSavedAddress(input({ label: "Home" }));
    const office = createSavedAddress(input({ label: "Office", addressLine1: "2 Work Road" }));

    setDefaultSavedAddress(office.id);

    expect(getDefaultAddress()?.id).toBe(office.id);
  });

  it("lists the default first, so the checkout radio order matches", () => {
    createSavedAddress(input({ label: "Home" }));
    const office = createSavedAddress(input({ label: "Office", addressLine1: "2 Work Road" }));
    setDefaultSavedAddress(office.id);

    expect(getSavedAddresses()[0].id).toBe(office.id);
  });

  it("falls back to any address when none is flagged default", () => {
    const created = createSavedAddress(input());
    updateSavedAddress(created.id, { isDefault: false });

    expect(getDefaultAddress()).not.toBeNull();
  });
});

describe("adding a second address", () => {
  it("does not steal the default", () => {
    const home = createSavedAddress(input({ label: "Home" }));
    createSavedAddress(input({ label: "Office", addressLine1: "2 Work Road" }));

    expect(getDefaultAddress()?.id).toBe(home.id);
    expect(getSavedAddresses()).toHaveLength(2);
  });

  it("keeps both destinations distinct", () => {
    createSavedAddress(input({ label: "Home", addressLine1: "1 Baker Street" }));
    createSavedAddress(input({ label: "Office", addressLine1: "2 Work Road" }));

    expect(getSavedAddresses().map((a) => a.addressLine1).sort()).toEqual([
      "1 Baker Street",
      "2 Work Road",
    ]);
  });
});

describe("deleting an address", () => {
  it("leaves a usable default behind", () => {
    const home = createSavedAddress(input({ label: "Home" }));
    createSavedAddress(input({ label: "Office", addressLine1: "2 Work Road" }));

    deleteSavedAddress(home.id);

    expect(getSavedAddresses()).toHaveLength(1);
    // Checkout must still have something to preselect.
    expect(getDefaultAddress()).not.toBeNull();
  });

  it("empties cleanly", () => {
    const only = createSavedAddress(input());
    deleteSavedAddress(only.id);

    expect(getSavedAddresses()).toHaveLength(0);
    expect(getDefaultAddress()).toBeNull();
  });
});
