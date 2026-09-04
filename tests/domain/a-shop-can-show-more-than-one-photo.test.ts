import { readFileSync } from "node:fs";
import path from "node:path";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { getProductGalleryImages } from "@/apps/website/lib/product-details";
import { mapAdminProductToStorefront } from "@/features/products/lib/product-mapper";
import { ProductGallery } from "@/components/storefront/product-gallery";
/**
 * Imported at the top, not inside a test: pulling the admin form in costs
 * five seconds of module graph, and inside an `it` that is the whole test
 * budget — the first one to touch it timed out while the two after it passed
 * off the warm cache.
 */
import { withPhotoAt } from "@/apps/admin/products/components/product-form-page";

/**
 * A shop could upload one photo, and the gallery that shows several had never
 * run.
 *
 * `images` is an ARRAY on the product type, in the Mongoose schema, in the Zod
 * validator, and in what the admin form submits (`images: form.images.filter(Boolean)`).
 * Four of the five gates were open the whole time. It was capped by two single
 * lines — one in the Media tab that wrote a one-element array, and one in the
 * storefront mapper that took only the first — plus a helper that returned a
 * single-element list unconditionally.
 *
 * The consequence was invisible rather than broken: `ProductGallery` renders its
 * thumbnail rail on `images.length > 1`, so the rail was unreachable code and
 * NOTHING IN THE SUITE RENDERED THIS COMPONENT AT ALL. This file is its first
 * test.
 */

vi.mock("@/hooks/use-business-labels", () => ({
  useBusinessLabels: () => ({
    collectionsTitle: "Our Collections",
    collectionsSubtitle: "",
    productWord: "Product",
    productWordPlural: "Products",
  }),
}));

function render(images: string[]) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(ProductGallery, { images, productName: "Cotton Tee" }));
  });

  return {
    container,
    thumbs: () => [...container.querySelectorAll("button[aria-label^='Show image']")],
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("the gallery a customer actually sees", () => {
  it("puts every photo in the rail", () => {
    const view = render(["/a.jpg", "/b.jpg", "/c.jpg"]);
    try {
      expect(view.thumbs()).toHaveLength(3);
    } finally {
      view.unmount();
    }
  });

  it("draws the rail as a vertical strip on a wide screen", () => {
    /**
     * The layout, not just the presence. The rail existed as a four-column grid
     * BELOW the photo; the shop asked for a strip beside it. jsdom applies no
     * media queries, so this asserts the responsive classes are on the element
     * that carries them — which is what actually decides the layout here.
     */
    const view = render(["/a.jpg", "/b.jpg"]);
    try {
      const rail = view.thumbs()[0]?.parentElement;
      const classes = rail?.className ?? "";
      expect(classes).toContain("lg:flex-col");
      expect(classes).toContain("lg:w-20");
      // …and still a row underneath on a phone, where a strip beside the photo
      // leaves neither big enough to read.
      expect(classes).toContain("grid-cols-4");
    } finally {
      view.unmount();
    }
  });

  it("shows the photo the customer picked", () => {
    const view = render(["/a.jpg", "/b.jpg"]);
    try {
      act(() => {
        view.thumbs()[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });
      const main = view.container.querySelector("button[aria-label^='Zoom'] img");
      expect(main?.getAttribute("src")).toContain("b.jpg");
    } finally {
      view.unmount();
    }
  });

  it("shows no rail for a product with one photo", () => {
    const view = render(["/only.jpg"]);
    try {
      expect(view.thumbs()).toHaveLength(0);
    } finally {
      view.unmount();
    }
  });

  it("still fills its column when a product has no photo at all", () => {
    /**
     * This returned `null`, which on the product page is not a missing photo
     * but a missing COLUMN: the gallery is the left cell of a two-column grid,
     * so the text sat alone beside an empty half. A new product is born with an
     * empty image list, so it is reachable.
     */
    const view = render([]);
    try {
      expect(view.container.innerHTML.trim().length).toBeGreaterThan(0);
    } finally {
      view.unmount();
    }
  });
});

describe("which photos the page is given", () => {
  const base = { image: "/first.jpg" } as never;

  it("returns every photo the shop stored", () => {
    expect(
      getProductGalleryImages({ image: "/first.jpg", images: ["/a.jpg", "/b.jpg"] } as never),
    ).toEqual(["/a.jpg", "/b.jpg"]);
  });

  it("falls back to the single image for a product mapped before the array", () => {
    expect(getProductGalleryImages(base)).toEqual(["/first.jpg"]);
  });

  it("drops blank slots rather than rendering an empty thumbnail", () => {
    expect(
      getProductGalleryImages({ image: "/first.jpg", images: ["/a.jpg", "  ", ""] } as never),
    ).toEqual(["/a.jpg"]);
  });

  it("never pads the rail out to a fixed length", () => {
    // A gallery filled with stock photos is a picture of something the customer
    // is not buying. One photo means one photo.
    expect(getProductGalleryImages({ image: "/one.jpg", images: ["/one.jpg"] } as never)).toEqual([
      "/one.jpg",
    ]);
  });

  it("answers with nothing when the product has no photo", () => {
    expect(getProductGalleryImages({ image: "" } as never)).toEqual([]);
  });
});

describe("the photos cross the mapper, which is a whitelist", () => {
  it("carries the whole array, not only the first", () => {
    const mapped = mapAdminProductToStorefront({
      id: "p-tee",
      name: "Cotton Tee",
      slug: "cotton-tee",
      description: "",
      price: 799,
      images: ["/a.jpg", "/b.jpg", "/c.jpg"],
      categoryId: "cat-shirts",
      occasionIds: [],
      weights: [],
      status: "published",
      shapes: [],
      flavourOptions: [],
      attributes: [],
      rating: 0,
      reviewCount: 0,
    } as never);

    // `image` stays, and stays first: cards, search and the shared-link preview
    // all read it and none of them wants an array.
    expect(mapped.image).toBe("/a.jpg");
    expect(mapped.images).toEqual(["/a.jpg", "/b.jpg", "/c.jpg"]);
  });
});

describe("the admin box that capped it", () => {
  const source = readFileSync(
    path.join(process.cwd(), "apps/admin/products/components/product-form-page.tsx"),
    "utf8",
  );
  /**
   * The docblock in that file NAMES the line it replaced, so an unstripped
   * search for it matches the explanation rather than the code — the exact way
   * a guard passes for the thing it forbids.
   */
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  const mediaTab = code.slice(
    code.indexOf('<TabsContent value="media"'),
    code.indexOf('<TabsContent value="seo"'),
  );

  it("no longer writes a one-photo array", () => {
    expect(mediaTab.length).toBeGreaterThan(100);
    expect(mediaTab).not.toContain("images: [url]");
    // Written through a setter that reads the array as it changes it: an
    // upload lands seconds after the click, and a captured copy put back then
    // wipes whatever was added meanwhile.
    expect(mediaTab).toContain("setPhotoSlot(");
    // …and never over a captured copy of the array: an upload that lands late
    // would write a stale one back and wipe whatever was added meanwhile.
    expect(mediaTab).not.toContain("form.images");
  });
});

describe("editing the list of photos", () => {
  it("replaces one photo and leaves the others alone", () => {
    expect(withPhotoAt(["/a.jpg", "/b.jpg"], 1, "/new.jpg")).toEqual(["/a.jpg", "/new.jpg"]);
  });

  it("accepts a write into the empty box below the last photo", () => {
    // The Media tab always renders one slot more than nothing, so a product
    // with no photos has somewhere to put the first. Indexing straight into
    // the stored array would drop that write.
    expect(withPhotoAt([], 0, "/first.jpg")).toEqual(["/first.jpg"]);
    expect(withPhotoAt(["/a.jpg"], 2, "/third.jpg")).toEqual(["/a.jpg", "", "/third.jpg"]);
  });

  it("empties a middle row rather than renumbering the ones below it", () => {
    /**
     * A row's identity in this list is its index — for React, and for an
     * upload that has not landed yet. Closing the gap moved a pending upload
     * onto somebody else's photo, so removal blanks in place instead. Blanks
     * never reach the database: the submit filters them out.
     */
    expect(withPhotoAt(["/a.jpg", "/b.jpg", "/c.jpg"], 1, "")).toEqual([
      "/a.jpg",
      "",
      "/c.jpg",
    ]);
  });
});
