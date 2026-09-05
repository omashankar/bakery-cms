import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductGallery } from "@/components/storefront/product-gallery";

/**
 * Looking closely at a photo, which is most of what a customer does here.
 *
 * The whole gallery was one picture and a `Dialog` that showed the same picture
 * bigger: no magnifier, and a viewer that opened on whichever photo was already
 * chosen and offered no way to reach the others except by closing it. The rail
 * that could have was outside the dialog, behind it.
 *
 * Two behaviours are tested here because two behaviours have arithmetic worth
 * getting wrong: WHERE the magnifier looks (a fraction of the photo, turned
 * into a background offset and a clamped lens) and WHICH photo the viewer is
 * on (an index that wraps in both directions, moved by two buttons and two
 * keys).
 */

vi.mock("@/hooks/use-business-labels", () => ({
  useBusinessLabels: () => ({
    collectionsTitle: "Our Collections",
    collectionsSubtitle: "",
    productWord: "Product",
    productWordPlural: "Products",
  }),
}));

/** The photo is drawn 400 square, so a pixel is a quarter of a percent. */
const FRAME = 400;

const mounted: Array<() => void> = [];

afterEach(() => {
  while (mounted.length) mounted.pop()?.();
});

function render(images: string[]) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(ProductGallery, { images, productName: "Cotton Tee" }));
  });

  mounted.push(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const photo = container.querySelector<HTMLElement>("button[aria-label^='Zoom']");
  /**
   * jsdom lays nothing out: every `getBoundingClientRect` is zeros, and the
   * fraction the magnifier is built on would be 0/0. Stating the frame is what
   * makes the arithmetic testable at all.
   */
  if (photo) {
    photo.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: FRAME, height: FRAME, right: FRAME, bottom: FRAME, x: 0, y: 0 }) as DOMRect;
  }

  return {
    container,
    photo,
    lens: () => container.querySelector<HTMLElement>("[data-testid='zoom-lens']"),
    panel: () => container.querySelector<HTMLElement>("[data-testid='zoom-panel']"),
    hint: () => container.querySelector("button[aria-label^='Zoom'] svg"),
    /** The viewer is portalled onto the body, not into our container. */
    viewer: () => document.body.querySelector<HTMLElement>("[role='dialog']"),
  };
}

/**
 * A pointer event jsdom will carry.
 *
 * `PointerEvent` is not implemented there, and `pointerType` is the one field
 * this component branches on — so it is set by hand onto a `MouseEvent`, which
 * is exactly what React reads it off.
 */
function pointerAt(type: string, x: number, y: number, pointerType = "mouse") {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
  Object.defineProperty(event, "pointerType", { value: pointerType });
  return event;
}

const hover = (view: ReturnType<typeof render>, x: number, y: number, pointerType = "mouse") => {
  act(() => {
    view.photo?.dispatchEvent(pointerAt("pointermove", x, y, pointerType));
  });
};

describe("the magnifier that follows a mouse", () => {
  it("shows the part of the photo the pointer is over", () => {
    const view = render(["/a.jpg"]);
    hover(view, FRAME * 0.25, FRAME * 0.75);

    // A quarter across and three quarters down, said in the units CSS uses to
    // slide an oversized background around inside its box.
    expect(view.panel()?.style.backgroundPosition).toBe("25% 75%");
  });

  it("draws the lens over the slice it is showing", () => {
    const view = render(["/a.jpg"]);
    hover(view, FRAME * 0.25, FRAME * 0.75);

    const lens = view.lens();
    // 2.5× means the panel holds 40% of the photo, so the lens is 40% wide…
    expect(lens?.style.width).toBe("40%");
    expect(lens?.style.height).toBe("40%");
    // …and centred on the pointer: 25 − 20, 75 − 20.
    expect(lens?.style.left).toBe("5%");
    expect(lens?.style.top).toBe("55%");
  });

  it("keeps the lens inside the photo at the corners", () => {
    /**
     * Centring alone puts half the lens outside the picture in every corner,
     * which reads as the magnifier having fallen off. The clamp is why the two
     * numbers are computed rather than just multiplied.
     */
    const view = render(["/a.jpg"]);

    hover(view, 0, 0);
    expect(view.lens()?.style.left).toBe("0%");
    expect(view.lens()?.style.top).toBe("0%");

    hover(view, FRAME, FRAME);
    expect(view.lens()?.style.left).toBe("60%");
    expect(view.lens()?.style.top).toBe("60%");
  });

  it("magnifies the photo the customer switched to, not the first one", () => {
    const view = render(["/a.jpg", "/b.jpg"]);
    act(() => {
      view.container
        .querySelectorAll("button[aria-label^='Show image']")[1]
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    hover(view, FRAME / 2, FRAME / 2);

    expect(view.panel()?.style.backgroundImage).toContain("b.jpg");
  });

  it("does nothing at all for a finger", () => {
    /**
     * The one that matters on a phone. A touch has no hover: every tap would
     * flash a magnifier over the thing being tapped and leave it there, and the
     * panel is drawn over the column with Add to Cart in it.
     */
    const view = render(["/a.jpg"]);
    hover(view, FRAME / 2, FRAME / 2, "touch");

    expect(view.lens()).toBeNull();
    expect(view.panel()).toBeNull();
  });

  it("puts the magnifier away when the pointer leaves", () => {
    const view = render(["/a.jpg"]);
    hover(view, FRAME / 2, FRAME / 2);
    expect(view.panel()).not.toBeNull();

    act(() => {
      /*
        `pointerout`, not `pointerleave`: leave does not bubble, so React never
        listens for it — it synthesises leave from the out event at the root.
        Dispatching leave directly tests a listener the browser will never call.
      */
      view.photo?.dispatchEvent(pointerAt("pointerout", -5, -5));
    });
    expect(view.lens()).toBeNull();
    expect(view.panel()).toBeNull();
  });

  it("never lets the magnifier swallow a click", () => {
    // It hangs over the buy box. Somebody moving towards Add to Cart must not
    // have their click land on a panel that is about to disappear.
    const view = render(["/a.jpg"]);
    hover(view, FRAME / 2, FRAME / 2);

    expect(view.panel()?.className).toContain("pointer-events-none");
    expect(view.lens()?.className).toContain("pointer-events-none");
  });

  it("drops the magnifying-glass hint once the magnifier is up", () => {
    // It is an invitation, and it stops being one the moment it is accepted.
    const view = render(["/a.jpg"]);
    expect(view.hint()).not.toBeNull();

    hover(view, FRAME / 2, FRAME / 2);
    expect(view.hint()).toBeNull();
  });
});

describe("the viewer a photo opens into", () => {
  const open = (images: string[]) => {
    const view = render(images);
    act(() => {
      view.photo?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    return view;
  };

  const shown = (view: ReturnType<typeof render>) =>
    view.viewer()?.querySelector("img[alt='Cotton Tee']")?.getAttribute("src") ?? "";

  const press = (key: string) => {
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    });
  };

  const click = (view: ReturnType<typeof render>, label: string) => {
    act(() => {
      view
        .viewer()
        ?.querySelector(`button[aria-label='${label}']`)
        ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  it("steps to the next photo from inside the viewer", () => {
    /**
     * It showed `activeImage` and nothing else. With one photo that was
     * complete; with several it was a dead end, because the rail that could
     * have moved it is outside the dialog and behind it.
     */
    const view = open(["/a.jpg", "/b.jpg", "/c.jpg"]);
    expect(shown(view)).toContain("a.jpg");

    click(view, "Next image");
    expect(shown(view)).toContain("b.jpg");
  });

  it("wraps round rather than stopping at the ends", () => {
    const view = open(["/a.jpg", "/b.jpg"]);
    click(view, "Previous image");
    expect(shown(view)).toContain("b.jpg");
  });

  it("offers every photo in the viewer, not only the one that was clicked", () => {
    const view = open(["/a.jpg", "/b.jpg", "/c.jpg"]);
    const strip = view.viewer()?.querySelectorAll("button[aria-label*='in the viewer']") ?? [];
    expect(strip).toHaveLength(3);

    act(() => {
      strip[2]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(shown(view)).toContain("c.jpg");
  });

  it("answers the arrow keys while it is open", () => {
    const view = open(["/a.jpg", "/b.jpg", "/c.jpg"]);

    press("ArrowRight");
    expect(shown(view)).toContain("b.jpg");
    press("ArrowLeft");
    expect(shown(view)).toContain("a.jpg");
    // Left from the first goes to the last, the same way the buttons do.
    press("ArrowLeft");
    expect(shown(view)).toContain("c.jpg");
  });

  it("leaves the arrow keys alone while it is shut", () => {
    /**
     * The listener is on the window, so an ungated one would move the photo
     * under somebody scrolling the page with the keyboard — with the gallery
     * off screen and nothing to explain why.
     */
    const view = render(["/a.jpg", "/b.jpg"]);
    press("ArrowRight");

    expect(
      view.container.querySelector("button[aria-label^='Zoom'] img")?.getAttribute("src"),
    ).toContain("a.jpg");
  });

  it("shows no arrows and no strip for a product with one photo", () => {
    const view = open(["/only.jpg"]);
    const viewer = view.viewer();

    expect(viewer?.querySelector("button[aria-label='Next image']")).toBeNull();
    expect(viewer?.querySelectorAll("button[aria-label*='in the viewer']")).toHaveLength(0);
    // …but the photo itself is still there. A single-photo viewer is a viewer.
    expect(shown(view)).toContain("only.jpg");
  });
});
