/**
 * `SafeImage` is downstream of data that often has no image.
 *
 * Its prop was typed `src: string`, and the type was simply wrong about what
 * reaches it. An order's stored items carry no `image` — the server re-prices
 * what the customer CHOSE, and the field is not part of that — so `src.trim()`
 * threw, React unwound to the nearest boundary, and the admin's order detail
 * page rendered "This page couldn't load" instead of the order. A whole screen
 * lost to a missing thumbnail, on three real orders in this shop.
 *
 * The component already knew what to do with nothing: everything below
 * `if (!resolvedSrc)` is the placeholder. It just never got there.
 *
 * Typechecking could not catch this — the value crosses from a Mixed-typed
 * Mongo document through a `PlacedOrder` cast, so TypeScript believes the
 * annotation rather than the data. That is exactly the case a test has to
 * cover, and it has to RENDER: the assertion is that the component does not
 * throw, which nothing about reading the source can tell you.
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import { SafeImage } from "@/components/shared/safe-image";

function render(props: Record<string, unknown>): { html: string; unmount: () => void } {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(SafeImage, props as never));
  });

  return {
    html: container.innerHTML,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe("an image the data does not have", () => {
  /**
   * Every shape an untyped document can hand over.
   *
   * `src ?? ""` would have covered the first two and still thrown on the rest —
   * and a number where a URL was expected is not exotic for a field that
   * travels through `Schema.Types.Mixed`.
   */
  const NOT_A_URL = [
    ["absent", undefined],
    ["null", null],
    ["empty", ""],
    ["blank", "   "],
    ["a number", 0],
    ["an object", {}],
  ] as const;

  it.each(NOT_A_URL)("renders a placeholder when the src is %s", (_label, src) => {
    const view = render({ src, alt: "Chocolate Truffle Delight" });

    // The placeholder, not an <img> pointing at nothing — a broken image icon
    // in an order row reads as "this cake is gone".
    expect(view.html, "an img was rendered with no usable source").not.toContain("<img");
    expect(view.html, "the alt text was lost with the image").toContain(
      "Chocolate Truffle Delight",
    );

    view.unmount();
  });

  it("still renders a real image", () => {
    // The counterpart, so the assertions above cannot be satisfied by a
    // component that renders the placeholder for everything.
    const view = render({ src: "https://example.com/cake.jpg", alt: "Cake" });

    expect(view.html).toContain("<img");
    expect(view.html).toContain("example.com/cake.jpg");

    view.unmount();
  });

  it("does not render a blob: url that outlived its page", () => {
    // Already the component's behaviour, pinned here because the guard above
    // sits in the same branch: a revoked object URL renders as a broken image.
    const view = render({ src: "blob:http://localhost/abc", alt: "Upload" });

    expect(view.html).not.toContain("<img");

    view.unmount();
  });
});
