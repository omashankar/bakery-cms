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

describe("the shop says how a block looks", () => {
  it("offers the three drawings in words a shop owner uses", () => {
    const text = draw([group()]).textContent ?? "";

    expect(text).toContain("Buttons");
    expect(text).toContain("Tickbox");
    expect(text).toContain("Already true");
  });

  it("shows what the customer will ACTUALLY get, not what is stored", () => {
    /**
     * A three-option block stored as "stated" cannot be drawn that way, and the
     * page ignores it. A dropdown showing an answer the page ignores is worse
     * than no dropdown, so the box reads the resolved value.
     */
    const impossible = group({
      render: "stated",
      options: [
        option({ id: "a", label: "Round", isDefault: true }),
        option({ id: "b", label: "Square" }),
        option({ id: "c", label: "Heart" }),
      ],
    });
    const select = draw([impossible]).querySelector("select");

    expect(select).toBeTruthy();
    expect((select as HTMLSelectElement).value).toBe("buttons");
  });

  it("greys out an answer this block cannot give, and says why", () => {
    const view = draw([
      group({
        options: [
          option({ id: "a", label: "Round", isDefault: true }),
          option({ id: "b", label: "Square" }),
          option({ id: "c", label: "Heart" }),
        ],
      }),
    ]);
    const disabled = [...view.querySelectorAll("option")].filter(
      (node) => (node as HTMLOptionElement).disabled,
    );

    expect(disabled.length).toBeGreaterThan(0);
    // The reason travels with the refusal, in the line the shop is reading.
    expect(disabled.map((node) => node.textContent).join(" ")).toContain("needs");
  });

  it("tells the shop what the page will draw, using its own words", () => {
    const text = draw([group({ name: "Wattage", options: [option({ id: "a", label: "65W", isDefault: true })] })])
      .textContent ?? "";

    expect(text).toContain("✓ 65W");
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
    draw([group({ type: "shape", name: "Shape" })]);

    // Through the DROPDOWN, which is the one write that replaces a group
    // wholesale. A move only reorders, so it could carry `type` while the
    // control that matters dropped it.
    const select = container!.querySelector("select") as HTMLSelectElement;
    act(() => {
      select.value = "checkbox";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(handed?.[0]?.type).toBe("shape");
    expect(handed?.[0]?.render).toBe("checkbox");
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
