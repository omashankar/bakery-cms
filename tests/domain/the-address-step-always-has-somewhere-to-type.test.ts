import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DeliveryAddressPicker } from "@/apps/website/checkout/components/delivery-address-picker";
import type { SavedAddress } from "@/apps/website/account/lib/customer-addresses";

/**
 * THE DELIVERY STEP COULD RENDER NEITHER AN ADDRESS CARD NOR AN ADDRESS FORM.
 *
 * `showAddressForm` was set true in exactly one place — the mount effect — and
 * set false again when step 1 was submitted. `DeliveryAddressPicker` returns
 * null on an empty book, and its "Add new" button is inside that early return.
 * The form's own Cancel renders only when a saved address already exists.
 *
 * So a customer with no saved address who unticked "Save this address for next
 * time" and then pressed Back landed on a step with no picker, no form, and no
 * control anywhere that could summon one: the date box and two buttons, and
 * nothing else. The typed values survived in the form state and still
 * submitted, which is worse than losing them — the address was there, being
 * sent to the shop, and could not be read or corrected.
 *
 * Two halves are pinned below. The picker's own asymmetry — nothing at all on
 * an empty book, including the button that would have been the way out — is
 * pinned by rendering it. And the page's gate is pinned as source, because
 * `CheckoutPage` cannot currently be rendered in this harness: its mount effect
 * is an async IIFE that, once a cart exists, leaves React's act queue draining
 * forever. The full-journey test belongs with the checkout rework, when these
 * screens are separate components small enough to mount.
 */

const PAGE = "apps/website/checkout/pages/checkout-page.tsx";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const ADDRESS: SavedAddress = {
  id: "a-1",
  label: "Home",
  fullName: "Om Suman",
  email: "om@example.com",
  phone: "7627014106",
  addressLine1: "Royal Sun City, Borkheda",
  addressLine2: "",
  city: "Kota",
  state: "Rajasthan",
  pincode: "324001",
  isDefault: true,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

function renderPicker(addresses: SavedAddress[]) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      createElement(DeliveryAddressPicker, {
        addresses,
        selectedId: addresses[0]?.id ?? "new",
        onSelect: () => undefined,
        onEdit: () => undefined,
        onAddNew: () => undefined,
      }),
    );
  });
  return container;
}

const addNewButton = () =>
  [...container!.querySelectorAll("button")].find((el) => /add new/i.test(el.textContent ?? ""));

describe("the picker offers no way in when there is nothing to pick", () => {
  it("renders nothing at all on an empty book", () => {
    // Not "an empty list with an Add button" — nothing. This is the half of the
    // defect that lives in the picker, and it is deliberate: a heading over no
    // cards reads as a list that failed to load.
    expect(renderPicker([]).textContent).toBe("");
  });

  it("so its Add new button is unreachable exactly when it is needed most", () => {
    /**
     * The asymmetry that made the blank step unrecoverable. A customer with one
     * saved address has a way to open the form; a customer with none has none,
     * which is the customer who has to type one.
     */
    renderPicker([]);
    expect(addNewButton()).toBeUndefined();

    act(() => root?.unmount());
    container?.remove();
    renderPicker([ADDRESS]);
    expect(addNewButton()).toBeDefined();
  });
});

describe("so the step opens the form from the book, not from a flag", () => {
  const page = code(PAGE);

  it("gates the form on a value that accounts for an empty book", () => {
    /**
     * Derived, not stored. The old gate was the raw `showAddressForm` state,
     * which could be false while the book was empty — the state the customer
     * was dropped into.
     */
    expect(page).toContain("const addressFormOpen = showAddressForm || savedAddresses.length === 0");
    expect(page).toContain("{addressFormOpen ? (");
    expect(page).not.toContain("{showAddressForm ? (");
  });

  it("no longer opens it once, at mount, and never again", () => {
    // The single `setShowAddressForm(true)` that used to carry this is gone;
    // what remains is the typed-but-unsaved case, which is a different reason.
    expect(page).not.toContain("if (addresses.length === 0) setShowAddressForm(true)");
  });
});
