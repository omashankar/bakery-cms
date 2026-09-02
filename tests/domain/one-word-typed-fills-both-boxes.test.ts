import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { describeWordingProblems, guessPlural } from "@/config/business-labels";

/**
 * Two blank boxes, filled independently, and nothing checking the pair.
 *
 * Settings > General asks for the shop's word twice — one item and more than
 * one. This install's owner typed "products" into BOTH, so every plural surface
 * read the singular ("All products" was fine; "Add products" was not) and the
 * admin looked broken in a way no code change could fix.
 *
 * The plural now follows the singular until somebody answers it themselves, and
 * the pair is checked. Both are GUESSES about English, so both are corrigible: a
 * shop selling Mithai is right and the rules here are not.
 */
describe("guessing a plural", () => {
  it("handles the endings that are not just plus-s", () => {
    expect(guessPlural("Box")).toBe("Boxes");
    expect(guessPlural("Dish")).toBe("Dishes");
    expect(guessPlural("Watch")).toBe("Watches");
    expect(guessPlural("Dress")).toBe("Dresses");
    expect(guessPlural("Candy")).toBe("Candies");
  });

  it("does not turn a vowel-y into -ies", () => {
    // Toy → Toys, not Toies. The rule is CONSONANT + y.
    expect(guessPlural("Toy")).toBe("Toys");
    expect(guessPlural("Tray")).toBe("Trays");
  });

  it("leaves -f alone", () => {
    /**
     * Loaf/Loaves is right and Chef/Chefs, Roof/Roofs and Belief/Beliefs are
     * not. A shop's goods are far likelier to be the second kind, and a wrong
     * guess here would be shown on every page of its storefront.
     */
    expect(guessPlural("Chef")).toBe("Chefs");
    expect(guessPlural("Roof")).toBe("Roofs");
  });

  it("keeps the capitalisation the shop typed", () => {
    expect(guessPlural("bouquet")).toBe("bouquets");
    expect(guessPlural("Bouquet")).toBe("Bouquets");
  });

  it("answers nothing for nothing", () => {
    // A blank singular must not produce a lone "s" in the plural box.
    expect(guessPlural("")).toBe("");
    expect(guessPlural("   ")).toBe("");
  });
});

describe("what the pair of words gets wrong", () => {
  it("names the mistake this shop actually made", () => {
    // A plural typed into the singular box. The button then says "Add products".
    expect(describeWordingProblems({ productWord: "products" }).productWord).toMatch(
      /Add products/,
    );
  });

  it("flags a singular and plural that are identical", () => {
    const problems = describeWordingProblems({
      productWord: "products",
      productWordPlural: "products",
    });

    expect(problems.productWordPlural).toBeTruthy();
  });

  it("says nothing about a shop that is simply right", () => {
    expect(describeWordingProblems({ productWord: "Bouquet", productWordPlural: "Bouquets" }))
      .toEqual({});
    // Blank is a real answer, not a mistake: a shop selling cakes AND chargers
    // wants the neutral default and should not be nagged toward a word.
    expect(describeWordingProblems({})).toEqual({});
    expect(describeWordingProblems({ productWord: "", productWordPlural: "" })).toEqual({});
  });

  it("does not flag a legitimate word that ends in double-s", () => {
    // Dress/Dresses. The check is for a plural-looking singular, and "ss" is not
    // one — flagging it would train an owner to ignore the warning.
    expect(describeWordingProblems({ productWord: "Dress" }).productWord).toBeUndefined();
  });
});

/**
 * The rule lives in the component, so it is driven through the component: the
 * plural follows the singular until the plural box is answered, and then never
 * again. Same shape as the product form's slug-follows-name.
 */
const repo = vi.hoisted(() => ({
  stored: {} as Record<string, string>,
  saved: null as Record<string, string> | null,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { message: vi.fn(), success: vi.fn(), error: vi.fn() } }));
vi.mock("@/apps/admin/settings/lib/report-settings-write", () => ({
  reportSettingsWrite: () => true,
  reportSettingsReset: () => true,
}));
vi.mock("@/features/settings/lib/settings-repository", () => ({
  SETTINGS_UPDATED_EVENT: "bakery-settings-updated",
  getGeneralSettings: () => ({
    siteName: "Real Shop",
    siteTagline: "",
    siteDescription: "",
    logo: "",
    favicon: "",
    timezone: "Asia/Kolkata",
    currency: "INR",
  }),
  getLabelSettings: () => repo.stored,
  saveGeneralSettings: async (value: unknown) => ({ value, persisted: true }),
  saveLabelSettings: async (value: Record<string, string>) => {
    repo.saved = value;
    return { value, persisted: true };
  },
  resetGeneralSettings: async () => ({ value: {}, persisted: true }),
  hydrateSettingsFromServer: async () => true,
  ensureSettingsHydrated: async () => true,
}));

let container: HTMLDivElement;

beforeEach(() => {
  repo.stored = {};
  repo.saved = null;
  container = document.createElement("div");
  document.body.append(container);
});
afterEach(() => container.remove());

async function mount() {
  const { GeneralSettingsPage } = await import(
    "@/apps/admin/settings/components/general-settings-page"
  );
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(GeneralSettingsPage));
  });
  return {
    one: () => container.querySelector<HTMLInputElement>("#productWord"),
    many: () => container.querySelector<HTMLInputElement>("#productWordPlural"),
    unmount: () => act(() => root.unmount()),
  };
}

/** React tracks its own value, so the setter has to be called natively. */
async function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value",
  )?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/**
 * A generous timeout, once. The first mount pulls the whole General settings
 * graph — photo fields, media, selects — and took 2.5s cold; the default 5s
 * left no margin, and a timeout mid-`act` leaked into the next case, which then
 * read the previous test’s input and failed for the wrong reason.
 */
describe("typing one word", { timeout: 30_000 }, () => {
  it("fills the plural box as you go", async () => {
    const form = await mount();
    const one = form.one();
    expect(one, "the singular box went missing").toBeTruthy();

    await type(one!, "Bouquet");

    expect(form.many()?.value).toBe("Bouquets");
    form.unmount();
  });

  it("stops guessing once the plural box is answered", async () => {
    const form = await mount();

    await type(form.one()!, "Mithai");
    expect(form.many()?.value).toBe("Mithais");

    // The shop corrects it — Mithai is already plural.
    await type(form.many()!, "Mithai");
    // …and keeps editing the singular. The English rule must not come back.
    await type(form.one()!, "Mithais");

    expect(form.many()?.value).toBe("Mithai");
    form.unmount();
  });

  it("never overwrites a plural the shop already saved", async () => {
    // The live install stores productWordPlural. Seeding the guess over it is
    // how a one-time convenience becomes a change nobody asked for.
    repo.stored = { productWord: "Mithai", productWordPlural: "Mithai" };
    const form = await mount();

    await type(form.one()!, "Mithaii");

    expect(form.many()?.value).toBe("Mithai");
    form.unmount();
  });
});
