import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductVariantGroup } from "@/types/product";

/**
 * The options editor asked the shop a question it could not answer, and never
 * asked the one it could.
 *
 * The question it asked was "Type: Shape or Custom" — a classification with no
 * visible consequence, whose union has been wrong for most of this catalogue for
 * a long time. 26 of the 29 live products carry groups typed `egg` or `photo`,
 * words the box has never offered, so it rendered blank on most of the shop and
 * one click silently retyped a group. That is how a Heart ended up inside "Egg
 * preference" on Ring Ceremony Special Cake, priced at ₹20, charged on every
 * order.
 *
 * The question it never asked is the one the customer sees the answer to: is
 * this a row of buttons, a tickbox, or a line stating a fact? All three already
 * existed, chosen by reading the data — and the rule was written nowhere the
 * shop could find it.
 *
 * So: that box is gone, this one is here, and every block and every choice can
 * be moved, because the order is what the customer reads.
 */

vi.mock("@/features/settings/lib/settings-repository", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getModuleSettings: () => ({
    weddingBuilder: true,
    flavour: true,
    weight: true,
    shape: true,
    photoCake: true,
  }),
  SETTINGS_UPDATED_EVENT: "settings-updated",
}));

const { ProductVariantManager } = await import(
  "@/apps/admin/products/components/product-variant-manager"
);

const FORM = "apps/admin/products/components/product-form-page.tsx";
const MANAGER = "apps/admin/products/components/product-variant-manager.tsx";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
/**
 * The same file with its comments taken out.
 *
 * A tombstone naming the very string it records the removal of is how a guard
 * like this fails on its own explanation — which both of the assertions below
 * did, on the first run, for the right reason.
 */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const option = (over: Record<string, unknown> = {}) => ({
  id: "o1",
  label: "A",
  priceAdjustment: 0,
  ...over,
});

const group = (over: Record<string, unknown> = {}): ProductVariantGroup =>
  ({
    id: "g1",
    name: "Shape",
    type: "custom",
    required: true,
    options: [option({ id: "round", label: "Round", isDefault: true }), option({ id: "sq", label: "Square" })],
    ...over,
  }) as never;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let handed: ProductVariantGroup[] | null = null;

function draw(groups: ProductVariantGroup[]) {
  handed = null;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      createElement(ProductVariantManager, {
        groups,
        basePrice: 999,
        onChange: (next: ProductVariantGroup[]) => {
          handed = next;
        },
      } as never),
    );
  });
  return container;
}

/**
 * Type into a controlled input the way a person does.
 *
 * Setting `.value` directly is invisible to React: its own value tracker sees
 * no change and swallows the event, so the handler never runs and the
 * assertion below it passes on `undefined`. The prototype setter is what makes
 * the tracker notice.
 */
const type = (element: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

const press = (label: string) => {
  const button = [...(container?.querySelectorAll("button") ?? [])].find(
    (node) => node.getAttribute("aria-label") === label,
  );
  expect(button, `no button labelled "${label}"`).toBeTruthy();
  act(() => {
    button!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  handed = null;
});

/** One thing the customer can tick — which is every block this editor makes. */
const block = (over: Record<string, unknown> = {}): ProductVariantGroup =>
  group({
    name: "Gift wrap",
    options: [option({ id: "o", label: "Gift wrap", priceAdjustment: 120 })],
    ...over,
  });

describe("a block is one thing, named once", () => {
  it("asks for a word, a price and a tick — and nothing else", () => {
    /**
     * The card asked for a question, then its answers, then a dropdown choosing
     * between three renderings. Every one of those was a concept the shop had to
     * learn before it could describe a gift wrap.
     *
     * The reference storefront has none of it: an option is a tickbox with a
     * word and a price, and the shop decides only whether it starts ticked.
     */
    const view = draw([block()]);
    const text = view.textContent ?? "";

    expect(view.querySelector("select"), "the How-it-looks dropdown is still here").toBeNull();
    expect(text).toContain("Option");
    expect(text).toContain("Adds to price");
    expect(text).toContain("Already on");
    // The two most similar words on the old card, for the two least similar
    // things. One box writes both now.
    expect(text).not.toContain("Option label");
  });

  it("writes the shop's word as both the question and the answer", () => {
    /**
     * A block offering one thing is NAMED after the thing. Both are written
     * because both are read — the label is what the customer sees, the name is
     * what the collections sidebar builds a filter box from — and
     * `formatVariantSummary` prints the pair once so an order line does not say
     * "Eggless: Eggless".
     */
    draw([block()]);
    type(container!.querySelector("input") as HTMLInputElement, "Eggless");

    expect(handed?.[0]?.name).toBe("Eggless");
    expect(handed?.[0]?.options[0]?.label).toBe("Eggless");
  });

  it("tells the shop what the page will draw, in the mark it will be read beside", () => {
    const asked = draw([block()]).textContent ?? "";
    expect(asked).toContain("☐ Gift wrap");

    const stated = draw([block({ options: [option({ id: "o", label: "65W", isDefault: true })] })])
      .textContent ?? "";
    expect(stated).toContain("✓ 65W");
  });

  it("still edits a stored block that holds several choices", () => {
    /**
     * Twenty-five products in this shop carry a Shape holding Round, Square and
     * Heart. A form that could no longer show them would strand data the shop
     * can see on its own storefront — so those keep the older surface, and only
     * those.
     */
    const legacy = group({
      options: [
        option({ id: "a", label: "Round", isDefault: true }),
        option({ id: "b", label: "Square" }),
        option({ id: "c", label: "Heart" }),
      ],
    });
    const text = draw([legacy]).textContent ?? "";

    expect(text).toContain("Choice");
    expect(text).toContain("Add a choice");
    expect(text).toContain("Round  ·  Square  ·  Heart");
  });
});

describe("the order is the shop's to set", () => {
  it("moves a block up and down", () => {
    draw([group({ id: "a", name: "Colour" }), group({ id: "b", name: "Size" })]);

    press("Move Size up");
    expect(handed?.map((entry) => entry.id)).toEqual(["b", "a"]);
  });

  it("moves a choice inside a block", () => {
    draw([group()]);

    press("Move Square up");
    expect(handed?.[0]?.options.map((entry) => entry.id)).toEqual(["sq", "round"]);
  });

  it("stops at the ends rather than wrapping round", () => {
    const view = draw([group({ id: "a", name: "Colour" }), group({ id: "b", name: "Size" })]);
    const disabled = [...view.querySelectorAll("button")].filter(
      (node) => (node as HTMLButtonElement).disabled,
    );

    // The first block cannot go up and the last cannot go down; likewise the
    // first and last choice inside the one block that has two.
    expect(disabled.map((node) => node.getAttribute("aria-label"))).toEqual(
      expect.arrayContaining(["Move Colour up", "Move Size down"]),
    );
  });

  it("names the row it moves, so the buttons are not four identical arrows", () => {
    const view = draw([group({ name: "Colour" })]);
    const labels = [...view.querySelectorAll("button")].map((node) =>
      node.getAttribute("aria-label"),
    );

    expect(labels).toContain("Move Colour up");
    expect(labels).toContain("Move Round down");
    expect(labels).toContain("Remove Square");
  });
});

describe("what the editor no longer asks", () => {
  it("has no Shape-or-Custom box", () => {
    const source = code(MANAGER);

    expect(source).not.toContain('<option value="shape">Shape</option>');
    expect(source).not.toContain('<option value="custom">Custom</option>');
    expect(source).not.toContain("groupTypeLabels");
  });

  it("still CARRIES the type it stopped asking about", () => {
    /**
     * The save is a whole-document replace, so a form that quietly stopped
     * carrying `type` would delete it product by product — and with it the only
     * thing the Shape module can still hide. The control is gone; the value is
     * not.
     */
    draw([block({ type: "shape", name: "Heart shape" })]);

    // Through the NAME box, which is the write that replaces a group wholesale.
    // A move only reorders, so it could carry `type` while the control that
    // matters dropped it.
    type(container!.querySelector("input") as HTMLInputElement, "Heart");

    expect(handed?.[0]?.type).toBe("shape");
    expect(handed?.[0]?.name).toBe("Heart");
  });

  it("holds the ends of both lists in the handler as well as on the button", () => {
    /**
     * The arrows are `disabled` at the ends, and that is what a person meets —
     * asserted above. This is the second lock: the handlers refuse an
     * out-of-range move on their own, so removing or forgetting the disabled
     * attribute cannot silently start swapping a row with `undefined`.
     *
     * Asserted on the source because the button is the only way in and it is
     * disabled, which is exactly the point.
     */
    const source = code(MANAGER);

    expect(source).toContain("if (target < 0 || target >= next.length) return;");
    expect(source).toContain("if (target < 0 || target >= options.length) return group;");
  });

  it("says what the Shape module does instead of asking the shop to classify", () => {
    const text = draw([group({ type: "shape" })]).textContent ?? "";

    expect(text).toContain("Shape module");
  });

  it("names nothing on the shop's behalf when a block is added", () => {
    /**
     * "Add option" used to write "Custom option" into the name box and
     * "Option 1" into the label — words no merchant typed, in boxes that then
     * look filled in. One product in this shop is literally called that.
     */
    const source = code(MANAGER);

    expect(source).toContain('createVariantGroup("", type, [createVariantOption("", 0, false)], true)');
    expect(source).not.toContain('"Custom option"');
  });
});

describe("the price column says which price it means", () => {
  it("calls an option's number what it does", () => {
    const text = draw([group()]).textContent ?? "";

    // "Price +/-" named the sign and not the meaning, three inches from a size
    // list holding FULL prices that reads almost the same.
    expect(text).toContain("Adds to price");
    expect(text).not.toContain("Price +/-");
  });

  it("and the size list keeps the absolute one", () => {
    /**
     * Two blocks both claiming to be the whole price cannot both be right. The
     * size ladder is the one the pricing code already reads that way —
     * `priceLine` charges `weights[i].price` and never reaches the base once a
     * row exists — so it keeps "Price" and everything else adds to it.
     */
    const form = read(FORM);

    expect(form).toContain("Price ({getActiveLocale().currency})");
  });
});

describe("what the shop chose is written down when it saves", () => {
  it("freezes the drawing this product already had", () => {
    /**
     * The migration, and there is no script. A block stored before the dropdown
     * existed carries no answer, and the page draws it by the same two
     * predicates it always did — so the day this ships nothing moves. The first
     * save writes down what it ALREADY looked like, resolved by the function
     * the customer's page resolves it with, so freezing cannot change the
     * picture either.
     */
    const form = read(FORM);

    expect(form).toContain("render: resolveBlockRender(group).render,");
    // Resolved, never the stored word: an answer the options no longer fit is
    // ignored by the page, and writing it back would keep a lie on the record.
    expect(form).not.toContain("render: group.render");
  });
});
