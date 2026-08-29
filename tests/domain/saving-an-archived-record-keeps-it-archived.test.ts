/**
 * Opening a retired cake to fix a typo must not put it back on the shop.
 *
 * The Add/Edit Cake form has a Status dropdown beside "Save Draft" and
 * "Publish". `saveProduct` built its payload as `{ ...form, status }` from the
 * button's own hardcoded literal, so the dropdown decided nothing — and on an
 * ARCHIVED cake, where the dropdown and the sidebar badge both read "archived",
 * pressing Save Draft sent `status: "draft"`. The cake was silently un-archived
 * by an edit that had nothing to do with its visibility. Pages had the same
 * shape, and worse: their Save draft is disabled unless the form is dirty, so on
 * an untouched archived page the only enabled button was Publish.
 *
 * This renders the real form against an archived record, clicks the real Save
 * button once, and reads the payload that reaches the API client. It is
 * deliberately not an assertion about `resolveSaveStatus` — that function is
 * covered in lib/publishing/save-status.test.ts and could be perfect while the
 * form went on ignoring it.
 *
 * Mount, ONE click, assert. No control is touched first: after the fix every
 * action the test needs is present at first render, and a state commit between
 * the click and the write is exactly what this harness cannot flush reliably.
 */
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Product } from "@/types/product";

const sent = vi.hoisted(() => ({ payloads: [] as { status?: string }[] }));

const ARCHIVED: Product = {
  id: "cake-1",
  name: "Retired Rum Ball",
  slug: "retired-rum-ball",
  description: "",
  price: 400,
  images: [],
  categoryId: "cat-cakes",
  occasionIds: [],
  weights: [],
  status: "archived",
  isFeatured: false,
  isBestSeller: false,
  isTrending: false,
  isEggless: false,
  isPhotoCake: false,
  isSeasonal: false,
  shapes: [],
  flavourOptions: [],
  stockStatus: "in_stock",
  stockQuantity: 0,
  unlimitedStock: true,
  allowsMessage: false,
  allowsPhotoUpload: false,
  variantGroups: [],
  rating: 0,
  reviewCount: 0,
  seo: { metaTitle: "", metaDescription: "" },
  createdAt: "",
  updatedAt: "",
} as Product;

vi.mock("@/features/products/data/products-client", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    fetchProduct: async () => ARCHIVED,
    updateProductRequest: async (_id: string, payload: { status?: string }) => {
      sent.payloads.push(payload);
      return payload;
    },
    createProductRequest: async (payload: { status?: string }) => {
      sent.payloads.push(payload);
      return payload;
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => "/admin/cakes/cake-1",
}));

const { ProductFormPage } = await import("@/apps/admin/products/components/product-form-page");

/** Render the form for the archived cake and hand back its buttons. */
async function openArchivedCake(): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  createRoot(container).render(
    createElement(ProductFormPage as never, { mode: "edit", cakeId: "cake-1" }),
  );

  // The form loads its record in an effect; wait for the fetch to land rather
  // than for a fixed tick.
  for (let i = 0; i < 60 && !container.textContent?.includes("Retired Rum Ball"); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return container;
}

/**
 * The save button, found by what it DOES rather than what it says.
 *
 * Matching "Save changes" exactly would make the payload assertion below fail
 * against the old code for the wrong reason — the label — and pass for any
 * future rename. Both the old "Save Draft" and the new "Save changes" match
 * this, so the only thing that can fail is the status that gets sent.
 */
function saveButton(container: HTMLElement): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll("button")).find((node) =>
      /^Save/.test(node.textContent?.trim() ?? ""),
    ) ?? null
  );
}

function buttonNamed(container: HTMLElement, label: string): HTMLButtonElement | null {
  return (
    Array.from(container.querySelectorAll("button")).find(
      (node) => node.textContent?.trim() === label,
    ) ?? null
  );
}

beforeEach(() => {
  sent.payloads.length = 0;
  document.body.innerHTML = "";
});

describe("an archived cake", () => {
  it("says it is archived, in the shop's own words", async () => {
    const container = await openArchivedCake();

    expect(container.textContent).toContain("Archived");
  });

  it("offers to save WITHOUT bringing it back", async () => {
    // "Save Draft" would be a lie on a record that is not a draft, so the
    // button relabels. Its absence is what proves the label is derived from the
    // stored status rather than hardcoded.
    const container = await openArchivedCake();

    expect(buttonNamed(container, "Save changes")).not.toBeNull();
    expect(buttonNamed(container, "Save Draft")).toBeNull();
  });

  it("stays archived when that save is pressed", async () => {
    const container = await openArchivedCake();
    const save = saveButton(container);
    expect(save, "the form never rendered a save button").not.toBeNull();

    save!.click();
    for (let i = 0; i < 60 && sent.payloads.length === 0; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    expect(sent.payloads, "the save never reached the API client").toHaveLength(1);
    expect(sent.payloads[0].status, "the cake was silently un-archived").toBe("archived");
  });

  it("still offers a way back, and says what it does", async () => {
    // The other half: archived must not be a trap. Publish is relabelled so the
    // admin knows the button puts it back on the shop.
    const container = await openArchivedCake();

    expect(buttonNamed(container, "Restore & publish")).not.toBeNull();
    expect(buttonNamed(container, "Publish")).toBeNull();
  });
});
