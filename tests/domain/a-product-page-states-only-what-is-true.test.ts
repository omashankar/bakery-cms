import { act, createElement } from "react";
import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A phone charger's page said it serves 8–10 people.
 *
 * `getProductWeightOptions` and `getProductShapeOptions` were changed to return
 * `[]` for a product that declares no tiers and no shapes — which is the whole
 * point of a catalogue that is not a bakery. But the page was left as it was,
 * and before that change neither list could BE empty: the weight one fell back
 * through the shop's catalog presets, the shape one to Round/Square/Heart. So
 * the page's empty cases were dead code, and the change made them the default:
 *
 *   - a "Weight" heading over no buttons
 *   - a "Shape" heading over no buttons
 *   - and, gated by nothing at all, "Serves 8–10 people · 1 kg" printed under
 *     the price as a statement of fact
 *
 * The 29 products already in this shop all carry weights and shapes, so none of
 * them hit it. The FIRST product created after that change does, and so does any
 * cake whose owner presses the new "Sold in one size" button.
 *
 * There is no other React-render test of this page in the suite, which is why
 * the regression shipped. Reading the source could not have caught it: every
 * individual expression was correct, and the defect was that a fallback stopped
 * being unreachable.
 */

/**
 * The delivery promise, made settable.
 *
 * It is filled by a client effect from “”, and in a test the effect always runs
 * — so the empty state the SERVER ships could not be reproduced at all, and an
 * assertion about it passed no matter what the component did.
 */
const promise = vi.hoisted(() => ({ value: "Next-day delivery" }));
vi.mock("@/apps/website/lib/product-details", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getDeliveryPromise: () => promise.value,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => "/store/cakes/x",
  useSearchParams: () => new URLSearchParams(),
}));

// The page fetches approved reviews on mount; the network is not under test.
vi.mock("@/features/reviews/lib/reviews-api", () => ({
  fetchApprovedReviews: async () => [],
  submitReview: async () => ({ ok: true }),
}));

const { ProductDetailPage } = await import("@/apps/website/pages/product-detail-page");

type Product = Record<string, unknown>;

/** A product with nothing bakery about it: no tiers, no shapes, no flavours. */
const CHARGER: Product = {
  id: "p-charger",
  name: "65W Type-C Charger",
  slug: "type-c-charger",
  description: "Fast charging for phones and laptops.",
  price: 1499,
  image: "/charger.jpg",
  category: "Chargers",
  inStock: true,
  weights: [],
  shapes: [],
  flavours: [],
  variantGroups: [
    {
      id: "g-storage",
      name: "Cable length",
      type: "custom",
      options: [
        { id: "o-1m", label: "1 m", priceAdjustment: 0, isDefault: true },
        { id: "o-2m", label: "2 m", priceAdjustment: 200 },
      ],
    },
  ],
};

/** A cake as this shop actually stores one. */
const CAKE: Product = {
  id: "p-bf",
  name: "Black Forest",
  slug: "black-forest",
  description: "Cherries and cream.",
  price: 999,
  image: "/bf.jpg",
  category: "Cakes",
  inStock: true,
  weights: [
    { label: "1 kg", price: 999, serves: "8–10" },
    { label: "2 kg", price: 1799, serves: "16–20" },
  ],
  // A bakery DOES call this Weight — and now it says so, in a box, rather
  // than the page saying it on every shop's behalf. A shirt shop types Size.
  weightLabel: "Weight",
  // Retired. `shapes` was a list of NAMES with nowhere to put a price; it is a
  // typed variant group below, so a Heart can cost more than a Round.
  shapes: [],
  // Retired with `shapes`, and for the same reason: an unpriced list of names
  // with a hard-coded picker. A flavour is a variant group now, so it can cost
  // money and a shop can name the group whatever it sells.
  flavours: [],
  variantGroups: [
    {
      id: "g-shape",
      name: "Shape",
      type: "shape",
      options: [
        { id: "round", label: "Round", priceAdjustment: 0, isDefault: true },
        { id: "heart", label: "Heart", priceAdjustment: 150 },
      ],
    },
    {
      id: "g-flavour",
      name: "Flavour",
      type: "custom",
      options: [
        { id: "choc", label: "Chocolate", priceAdjustment: 0, isDefault: true },
        { id: "vanilla", label: "Vanilla", priceAdjustment: 0 },
      ],
    },
  ],
};

function render(cake: Product, modules = defaultModuleSettings): {
  /** The mounted DOM, for the few assertions that are about ELEMENTS. */
  container: HTMLDivElement;
  html: string;
  /**
   * Open a tab by its label and hand back the markup that follows.
   *
   * These WERE tabs, and Radix mounted only the active one — so asserting on a
   * tab’s text without opening it passed for a product that had no such tab at
   * all, which a first version of these tests did. They are stacked sections
   * now, all of them in the HTML, so nothing has to be clicked.
   *
   * This still THROWS when the section is absent, which is the half that
   * mattered: a page that stopped rendering ingredients entirely must not pass
   * a test about what its ingredients say.
   */
  section: (heading: string) => string;
  unmount: () => void;
} {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      createElement(ProductDetailPage, {
        cake,
        related: [],
        catalog: [],
        // Every module ON, which is what these cases assume — and now stated
        // rather than inherited from a default the page no longer has.
        modules,
      } as never),
    );
  });

  return {
    container,
    html: container.innerHTML,
    section: (heading: string) => {
      const found = [...container.querySelectorAll("section")].find((element) =>
        element.querySelector("h2")?.textContent?.trim().startsWith(heading),
      );
      if (!found) throw new Error(`no "${heading}" section on the page`);
      return found.textContent ?? "";
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("a product that is sold one way says so by saying nothing", () => {
  it("does not claim a charger serves 8–10 people or weighs 1 kg", () => {
    const { html, unmount } = render(CHARGER);
    try {
      // The regression, exactly. Both strings came from `?? "8–10"` and
      // `?? "1 kg"` in a line no module and no length check guarded.
      expect(html).not.toContain("Serves");
      expect(html).not.toContain("1 kg");
    } finally {
      unmount();
    }
  });

  it("renders no Weight heading and no Shape heading when there is nothing to choose", () => {
    const { html, unmount } = render(CHARGER);
    try {
      // A heading over an empty list. `modules.weight` and `modules.shape`
      // default ON and are shop-wide, so a shop selling cakes AND chargers
      // cannot switch these off — the guard has to come from the product.
      expect(html).not.toContain(">Weight<");
      expect(html).not.toContain(">Shape<");
      expect(html).not.toContain(">Flavour<");
    } finally {
      unmount();
    }
  });

  it("still renders the option the shop DID configure", () => {
    const { html, unmount } = render(CHARGER);
    try {
      expect(html).toContain("Cable length");
      expect(html).toContain("2 m");
    } finally {
      unmount();
    }
  });
});

describe("a module the shop switched off", () => {
  it("is off in the FIRST render, not corrected a beat later", () => {
    /**
     * `modules` seeded from `defaultModuleSettings` — every module ON — and was
     * corrected in a client effect reading localStorage, which the server does
     * not have. So a shop that had switched Flavour off still shipped the
     * Flavour picker in the HTML the browser and the crawler received, and it
     * vanished on hydration. A gate that fails open on the server is not a
     * gate. It is a required prop now, read on the server.
     *
     * This renders with the effect suppressed as far as the assertion goes: it
     * asserts the markup captured at mount, before any correction could land.
     */
    /**
     * `shape`, not `flavour`. A Flavour group is a plain custom group a shop
     * NAMES — no module gates it, which is the point of retiring the hard-coded
     * picker. `variantGroupsEnabledBy` still gates the typed ones, and that
     * shared filter is what the server value has to reach.
     */
    const { html, unmount } = render(CAKE, { ...defaultModuleSettings, shape: false });
    try {
      expect(html).not.toContain("Heart");
      // …and the ones still on are still there, so this is not passing by
      // rendering nothing at all.
      expect(html).toContain(">Weight<");
      expect(html).toContain(">Flavour<");
    } finally {
      unmount();
    }
  });
});

describe("the shop's own facts reach the page", () => {
  it("prints the attributes a charger declares", () => {
    const { section, unmount } = render({
      ...CHARGER,
      attributes: [
        { id: "a1", label: "Brand", value: "Anker" },
        { id: "a2", label: "Warranty", value: "1 year" },
      ],
    });
    try {
      const opened = section("Product Description");
      expect(opened).toContain("Brand");
      expect(opened).toContain("Anker");
      expect(opened).toContain("Warranty");
      expect(opened).toContain("1 year");
    } finally {
      unmount();
    }
  });

  it("offers no Details tab to a product that states nothing", () => {
    const { html, unmount } = render(CHARGER);
    try {
      expect(html).not.toContain(">Details<");
    } finally {
      unmount();
    }
  });
});

describe("the food tabs belong to food", () => {
  it("shows a charger no Ingredients, Nutrition, Allergens or Care tab", () => {
    /**
     * Each of these used to render unconditionally with bakery prose to print
     * when the field was empty — so a phone charger's page carried an
     * Ingredients tab reading "Flour, sugar, butter, fresh cream, premium
     * chocolate, and natural flavours", a Care tab saying "Refrigerate within
     * 2 hours of delivery", and a Nutrition tab promising calorie information.
     */
    const { html, unmount } = render(CHARGER);
    try {
      expect(html).not.toContain("Ingredients:");
      expect(html).not.toContain("Allergens:");
      expect(html).not.toContain("Care Instructions:");
      expect(html).not.toContain("Flour, sugar, butter");
      expect(html).not.toContain("Refrigerate within 2 hours");
      expect(html).not.toContain("Calorie information will be updated soon");
    } finally {
      unmount();
    }
  });

  it("does not append a bakery sentence to every description", () => {
    const { html, unmount } = render(CHARGER);
    try {
      expect(html).toContain("Fast charging for phones and laptops.");
      expect(html).not.toContain("finished by");
      expect(html).not.toContain("expert bakers");
    } finally {
      unmount();
    }
  });

  it("still shows a cake everything it actually fills", () => {
    const { html, section, unmount } = render({
      ...CAKE,
      ingredients: "Flour, cocoa, cream.",
      allergens: "Contains milk and wheat.",
      careInstructions: "Refrigerate on arrival.",
      calories: 320,
    });
    try {
      /**
       * One section with labelled parts, where there were six headings. Same
       * data, same gating — a part still appears only where the shop filled
       * the field — but a customer scanning for “does it have nuts” reads one
       * block rather than six.
       */
      expect(html).toContain("Ingredients:");
      expect(html).toContain("Allergens:");
      expect(html).toContain("Care Instructions:");
      // In the HTML, not behind a click — which is also what a crawler gets.
      const described = section("Product Description");
      expect(described).toContain("Flour, cocoa, cream.");
      expect(described).toContain("Refrigerate on arrival.");
      // The three fixed food facts are bullets in the same list as the
      // shop's own, rather than a Nutrition heading over three lines.
      expect(described).toContain("320 kcal per serving");
    } finally {
      unmount();
    }
  });
});

describe("the page does not call every product a cake", () => {
  it("offers a neutral message box, not a cake message", () => {
    const { html, unmount } = render({ ...CHARGER, allowsMessage: true });
    try {
      expect(html).not.toContain("Cake message");
      expect(html).not.toContain("Happy Birthday Rahul");
    } finally {
      unmount();
    }
  });

  it("claims nothing about how the product was made", () => {
    const { html, unmount } = render(CHARGER);
    try {
      // An unconditional bullet under every product in the shop.
      expect(html).not.toContain("Freshly baked");
    } finally {
      unmount();
    }
  });

  it("advertises only the codes a checkout will honour", () => {
    /**
     * The offers block is a PROMISE, and this repo has broken it before: the
     * homepage row advertised “20% OFF · code BDAY20” off a hardcoded array,
     * so deactivating the coupon left the offer up and checkout refused the
     * code. Putting the same row on every product page multiplies that by the
     * whole catalogue.
     */
    localStorage.setItem(
      "bakery-cms-coupons",
      JSON.stringify([
        {
          id: "c1",
          code: "LIVE10",
          label: "10% OFF",
          description: "",
          percentOff: 10,
          isActive: true,
          usageCount: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "c2",
          code: "SWITCHEDOFF",
          label: "50% OFF",
          description: "",
          percentOff: 50,
          isActive: false,
          usageCount: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "c3",
          code: "LASTYEAR",
          label: "Rs 500 off",
          description: "",
          flatOff: 500,
          isActive: true,
          usageCount: 0,
          createdAt: "2020-01-01T00:00:00.000Z",
          expiresAt: "2020-12-31T00:00:00.000Z",
        },
      ]),
    );

    const { html, unmount } = render(CHARGER);
    try {
      expect(html).toContain("LIVE10");
      expect(html).not.toContain("SWITCHEDOFF");
      expect(html).not.toContain("LASTYEAR");
    } finally {
      unmount();
    }
  });

  it("does not say a reviewed product has no reviews", () => {
    /**
     * `reviews` is fetched on the CLIENT and starts empty, so the server HTML
     * of a product carrying 4.8 stars also carried “No published reviews yet” —
     * a page contradicting itself, to a crawler, on the very commit whose motive
     * was that tabbed content never reached one. `reviewCount` is on the payload
     * and renders server-side, exactly like the stars.
     */
    const { html, unmount } = render({ ...CHARGER, rating: 4.8, reviewCount: 29 });
    try {
      expect(html).not.toContain("No published reviews yet");
      expect(html).toContain("(29)");
    } finally {
      unmount();
    }
  });

  it("still offers to be the first review on a product that has none", () => {
    const { html, unmount } = render({ ...CHARGER, rating: 0, reviewCount: 0 });
    try {
      expect(html).toContain("No published reviews yet");
    } finally {
      unmount();
    }
  });

  it("does not start the delivery line with a full stop", () => {
    /**
     * `deliveryPromise` starts “” and is filled by a client effect, so the
     * server HTML read “. Scheduled delivery on your selected date.” Asserted on
     * the section’s TEXT rather than the markup: React splits an interpolation
     * into its own text node, so a markup-level regex looking for “>.” never
     * matched and the case passed for the bug it names.
     */
    promise.value = "";
    const { html, section, unmount } = render(CHARGER);
    try {
      /**
       * The promise is a BULLET now, and an empty one is filtered out rather
       * than rendered — so the failure this names cannot take the shape it
       * once did. An empty `<li>` is what it would look like instead, and that
       * is what this looks for.
       */
      expect(html, "an empty delivery note reached the page").not.toMatch(
        /<li[^>]*>\s*<\/li>/,
      );
      expect(section("Product Description")).toContain("Scheduled delivery");
    } finally {
      unmount();
      promise.value = "Next-day delivery";
    }
  });

  it("says the minimum a coupon needs, where it has one", () => {
    /**
     * `isLiveCoupon` deliberately excludes `minSubtotal` — an offer with a
     * minimum is a real offer and the customer can qualify by adding to the
     * basket. `coupon-offers` says in as many words that it must therefore be
     * SHOWN, or a card sends somebody with a small basket to a checkout that
     * refuses the code, which is the failure that module exists to end. This
     * block dropped it and advertised the discount alone.
     */
    localStorage.setItem(
      "bakery-cms-coupons",
      JSON.stringify([
        {
          id: "c1",
          code: "SAVE500",
          label: "Rs 500 off",
          description: "",
          flatOff: 500,
          minSubtotal: 2000,
          isActive: true,
          usageCount: 0,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ]),
    );

    const { html, unmount } = render(CHARGER);
    try {
      expect(html).toContain("SAVE500");
      expect(html).toMatch(/on orders over/i);
      expect(html).toContain("2,000");
    } finally {
      unmount();
    }
  });

  it("does not read a claim out of the category NAME", () => {
    /**
     * `category.toLowerCase().includes("eggless")` and `.includes("photo")`
     * decided what the page claimed and which controls it offered — so a
     * category a shop had named “Photo Frames” got a photo-cake uploader, and
     * every product filed under “Eggless Sponges” was described as made without
     * eggs whatever the product itself said. Business-type control by another
     * name, decided by a word typed for filing.
     */
    const { html, unmount } = render({
      ...CHARGER,
      category: "Eggless Photo Frames",
      isEggless: false,
      allowsPhotoUpload: false,
    });
    try {
      expect(html).not.toContain("without eggs");
      expect(html).not.toContain("Upload your photo");
    } finally {
      unmount();
    }
  });

  it("still offers the photo upload where the PRODUCT says so", () => {
    // …so the case above is not passing by rendering nothing at all.
    const { html, unmount } = render({
      ...CHARGER,
      category: "Frames",
      allowsPhotoUpload: true,
    });
    try {
      expect(html).toContain("Upload your photo");
    } finally {
      unmount();
    }
  });

  it("does not say a charger is made without eggs", () => {
    /**
     * The trust strip under Add to Cart said “Eggless available” gated on the
     * egg MODULE alone — not on whether this product is eggless — so it printed
     * under every product in any shop that had the module on. A fallback
     * presented as a fact, in the three lines whose whole job is to be the
     * reason to trust the page.
     *
     * The module IS on here: `getModuleSettings` reads an empty localStorage
     * and answers with the all-on defaults. So this fails unless the product
     * itself is consulted.
     */
    const { html, unmount } = render({ ...CHARGER, isEggless: false });
    try {
      expect(html).not.toContain("without eggs");
    } finally {
      unmount();
    }
  });

  it("does not promise a message card on a product that takes no message", () => {
    const { section, unmount } = render({ ...CHARGER, allowsMessage: false });
    try {
      expect(section("Product Description")).not.toContain("message card");
    } finally {
      unmount();
    }
  });

  it("survives a product whose category could not be resolved", () => {
    /**
     * `mapAdminProductToStorefront` fell back to the literal "Cakes" for a
     * product whose category id resolves to nothing, so an orphaned charger was
     * badged "Cakes" to customers. Removing that fallback alone is not safe:
     * this page reads `cake.category.toLowerCase()` twice, so an absent category
     * is the same TypeError class that sat dead in `getProductVariantGroups`
     * until a change made it live.
     */
    const { html, unmount } = render({ ...CHARGER, category: undefined });
    try {
      expect(html).not.toContain("Cakes");
    } finally {
      unmount();
    }
  });
});

describe("a cake still says everything it used to", () => {
  it("prints its own tier under the price, not a fallback", () => {
    const { html, unmount } = render(CAKE);
    try {
      expect(html).toContain("Serves 8–10 people");
      expect(html).toContain("1 kg");
    } finally {
      unmount();
    }
  });

  it("renders the Weight and Flavour choices it actually offers", () => {
    const { html, unmount } = render(CAKE);
    try {
      expect(html).toContain(">Weight<");
      // From `group.name`, not from a hard-coded label. The picker that used to
      // print this word is gone; the same loop that renders Colour or Storage
      // renders it now.
      expect(html).toContain(">Flavour<");
      expect(html).toContain("2 kg");
      expect(html).toContain("Vanilla");
    } finally {
      unmount();
    }
  });

  /**
   * An ADD-ON reads as a tick, a CHOICE reads as buttons — and the rule is read
   * off the DATA, not the group’s name, so naming it “Shape” or “Egg preference”
   * changes nothing.
   */
  it("shows a two-option upgrade as one tick, labelled with the option", () => {
    // CAKE’s Shape group is Round (free, default) and Heart (+150) — a
    // yes-or-no, which used to arrive as a heading over two buttons.
    const { html, unmount } = render(CAKE);
    try {
      expect(html).toContain("Heart");
      // No heading, and no button for the free side to be “off”.
      expect(html).not.toContain(">Shape<");
      /**
       * And no price tag on the words. The surcharge WAS printed beside the
       * label; it reads as a price on the name of the thing, and on an add-on
       * that costs nothing it said “+₹0”. The price block above these boxes
       * moves the moment one is ticked, which is where a total belongs and the
       * only place that stays right when several are ticked at once —
       * an-add-on-is-a-tickbox-nobody-ticked-yet holds it to that.
       */
      expect(html).not.toContain("+₹150");
    } finally {
      unmount();
    }
  });

  it("does not tick-ify a two-way choice where neither side costs more", () => {
    /**
     * Round or Square, both free. A tick has to make one of them the “off”
     * state, and there is no reason to pick either — the customer would see a
     * box labelled Square whose unticked meaning is Round, stated nowhere.
     */
    const { html, unmount } = render({
      ...CAKE,
      variantGroups: [
        {
          id: "g-shape",
          name: "Shape",
          type: "shape",
          options: [
            { id: "round", label: "Round", priceAdjustment: 0, isDefault: true },
            { id: "square", label: "Square", priceAdjustment: 0 },
          ],
        },
      ],
    } as never);
    try {
      expect(html).toContain(">Shape<");
    } finally {
      unmount();
    }
  });

  it("does not tick-ify a group whose DEFAULT is the paid side", () => {
    /**
     * A tick starts unticked, and this group starts on the Rs 150 option. The
     * customer would see an empty box while already being charged for it — and
     * the grid card, which prices each group’s default, would disagree with the
     * page by exactly that amount.
     */
    const { html, unmount } = render({
      ...CAKE,
      variantGroups: [
        {
          id: "g-shape",
          name: "Shape",
          type: "shape",
          options: [
            { id: "heart", label: "Heart", priceAdjustment: 150, isDefault: true },
            { id: "round", label: "Round", priceAdjustment: 0 },
          ],
        },
      ],
    } as never);
    try {
      expect(html).toContain(">Shape<");
    } finally {
      unmount();
    }
  });

  it("shows a real three-way choice as buttons", () => {
    const { html, unmount } = render({
      ...CAKE,
      variantGroups: [
        {
          id: "g-shape",
          name: "Shape",
          type: "shape",
          options: [
            { id: "round", label: "Round", priceAdjustment: 0, isDefault: true },
            { id: "square", label: "Square", priceAdjustment: 0 },
            { id: "heart", label: "Heart", priceAdjustment: 150 },
          ],
        },
      ],
    } as never);
    try {
      expect(html).toContain(">Shape<");
      expect(html).toContain("Square");
    } finally {
      unmount();
    }
  });
});

describe("an upgrade whose base option is not free", () => {
  /** Regular +Rs 3, Eggless +Rs 80 — a real shop's egg group. */
  const PAID_BASE = {
    ...CAKE,
    variantGroups: [
      {
        id: "g-egg",
        name: "Egg preference",
        type: "egg",
        options: [
          { id: "regular", label: "Regular", priceAdjustment: 3, isDefault: true },
          { id: "eggless", label: "Eggless", priceAdjustment: 80 },
        ],
      },
    ],
  };

  it("is still one tick, not a heading over two buttons", () => {
    /**
     * The rule looked for an option priced at exactly zero and refused
     * everything else, so a shop whose base option carries a small charge of
     * its own got two buttons and a title for what is plainly one yes-or-no
     * question. Nothing about a tick needs the unticked side to be free — it
     * needs to be what the customer gets by not ticking, which is the default.
     */
    const { html, unmount } = render(PAID_BASE as never);
    try {
      expect(html).toContain("Eggless");
      expect(html).not.toContain(">Egg preference<");
      // …and the option the customer gets for NOT ticking has no button of its
      // own, because the unticked box is that button.
      expect(html).not.toContain(">Regular<");
    } finally {
      unmount();
    }
  });

  it("puts no price on the label, whatever the option costs", () => {
    /**
     * The box is named for the thing being offered, and that is all it says.
     * When the surcharge was printed here it had to be the DIFFERENCE from the
     * default — Rs 77, not Rs 80, because the Rs 3 is already inside the price
     * above it — which is exactly the sort of number a label should not be
     * carrying. The price block does it instead, live, and correctly when
     * several boxes are ticked at once.
     */
    const { html, unmount } = render(PAID_BASE as never);
    try {
      expect(html).toContain("Eggless");
      expect(html).not.toContain("+₹77");
      expect(html).not.toContain("+₹80");
    } finally {
      unmount();
    }
  });

  it("still refuses a group with a third option in it", () => {
    /**
     * Three options is three choices, and a single tick can only ever offer
     * two. Collapsing it would silently remove one the shop had configured and
     * can still sell — the answer to that is to delete the option in the admin,
     * not to hide it from the customer.
     */
    const { html, unmount } = render({
      ...CAKE,
      variantGroups: [
        {
          id: "g-egg",
          name: "Egg preference",
          type: "egg",
          options: [
            { id: "cream", label: "Cream", priceAdjustment: 0, isDefault: true },
            { id: "regular", label: "Regular", priceAdjustment: 3 },
            { id: "eggless", label: "Eggless", priceAdjustment: 80 },
          ],
        },
      ],
    } as never);
    try {
      expect(html).toContain(">Egg preference<");
    } finally {
      unmount();
    }
  });
});

describe("one Product Description, the way a customer reads it", () => {
  /** A cake with something in every part of it. */
  const FULL = {
    ...CAKE,
    description: "A classic, finished the morning it goes out.",
    ingredients: "Flour, cocoa, cream.",
    allergens: "Contains milk and wheat.",
    careInstructions: "Refrigerate on arrival.\nServe at room temperature.\n\nEat within 24 hours.",
    calories: 320,
    shelfLifeDays: 3,
    attributes: [
      { id: "a1", label: "Country of Origin", value: "India" },
      { id: "a2", label: "Net Quantity", value: "1 cake" },
    ],
  };

  it("gathers six headings into one", () => {
    /**
     * Details, ingredients, nutrition, allergens, care and delivery each had a
     * heading of its own. Every one was true and properly gated, but six
     * headings for six short blocks reads as six subjects when it is one.
     */
    const { html, unmount } = render(FULL as never);
    try {
      expect(html).toContain("Product Description");
      // The old headings, gone — these are labelled parts now.
      expect(html).not.toContain(">Nutrition<");
      expect(html).not.toContain(">Care instructions<");
      expect(html).not.toContain(">Delivery<");
    } finally {
      unmount();
    }
  });

  it("puts the shop's own facts and the food facts in one list", () => {
    const { section, unmount } = render(FULL as never);
    try {
      const described = section("Product Description");
      expect(described).toContain("Country of Origin: India");
      expect(described).toContain("Net Quantity: 1 cake");
      // …and the three fixed fields that used to have a Nutrition heading.
      expect(described).toContain("320 kcal per serving");
      expect(described).toContain("3 days when stored properly");
    } finally {
      unmount();
    }
  });

  it("makes one bullet of each line the shop typed", () => {
    /**
     * A shop writes care notes as a list and they arrived as one run-on
     * paragraph. Blank lines between them are spacing, not a bullet.
     */
    const view = render(FULL as never);
    try {
      // Scoped to the section: the breadcrumb above renders its separators as
      // empty list items, so counting every <li> on the page measures the
      // wrong thing.
      const described = [...view.container.querySelectorAll("section")].find((element) =>
        element.querySelector("h2")?.textContent?.includes("Product Description"),
      );
      const bullets = [...(described?.querySelectorAll("li") ?? [])].map((node) =>
        (node.textContent ?? "").trim(),
      );
      expect(bullets).toContain("Refrigerate on arrival.");
      expect(bullets).toContain("Serve at room temperature.");
      expect(bullets).toContain("Eat within 24 hours.");
      expect(bullets).not.toContain("");
    } finally {
      view.unmount();
    }
  });

  it("moves the shop's paragraph out from between the name and the price", () => {
    /**
     * It sat directly under the product name, above the price block — a
     * paragraph of prose between the customer and the two things they opened
     * the page for.
     */
    const view = render(FULL as never);
    try {
      const described = view.section("Product Description");
      expect(described).toContain("A classic, finished the morning it goes out.");

      const heading = view.container.querySelector("h2");
      const priceIndex = (view.container.textContent ?? "").indexOf("₹");
      const proseIndex = (view.container.textContent ?? "").indexOf("A classic, finished");
      expect(heading).toBeTruthy();
      expect(proseIndex, "the description is still above the price").toBeGreaterThan(priceIndex);
    } finally {
      view.unmount();
    }
  });

  it("says nothing at all about a product the shop has described nowhere", () => {
    // A charger with no ingredients, no care notes, no attributes and no prose
    // gets no heading — not an empty one.
    const { html, unmount } = render({ ...CHARGER, description: "" } as never);
    try {
      expect(html).not.toContain("Product Description");
    } finally {
      unmount();
    }
  });
});

describe("the buy box says what this shop can back", () => {
  it("does not claim the price includes tax", () => {
    /**
     * The reference storefront prints "Inclusive of all taxes" under the price.
     * Copying it here would be a lie: `computeTaxAmount` returns tax as a
     * SEPARATE line and the total is `subtotal + … + tax`, so the number above
     * it is the pre-tax one. The invoice terms were rewritten for exactly this
     * reason once already — they used to say "GST is included where applicable"
     * over a breakdown that printed it separately.
     */
    const { html, unmount } = render(CAKE);
    try {
      expect(html).not.toContain("Inclusive of all taxes");
      expect(html).toContain("added at checkout");
    } finally {
      unmount();
    }
  });

  it("puts the badge on the photo rather than in a row of chips", () => {
    const view = render({ ...CAKE, badge: "Bestseller" } as never);
    try {
      const gallery = view.container.querySelector("button[aria-label^='Zoom']");
      expect(gallery?.textContent).toContain("Bestseller");
    } finally {
      view.unmount();
    }
  });

  it("says nothing where the shop has awarded no badge", () => {
    const view = render(CAKE);
    try {
      const gallery = view.container.querySelector("button[aria-label^='Zoom']");
      expect((gallery?.textContent ?? "").trim()).toBe("");
    } finally {
      view.unmount();
    }
  });
});

describe("serving info, where the shop has said", () => {
  it("offers it beside the size picker", () => {
    // CAKE's tiers carry `serves`, which is what makes the link honest.
    const { html, unmount } = render(CAKE);
    try {
      expect(html).toContain("Serving Info");
    } finally {
      unmount();
    }
  });

  it("lists who each size feeds once opened", () => {
    const view = render(CAKE);
    try {
      const link = [...view.container.querySelectorAll("button")].find(
        (node) => node.textContent?.trim() === "Serving Info",
      );
      act(() => {
        link?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      const text = view.container.textContent ?? "";
      expect(text).toContain("1 kg");
      expect(text).toContain("serves 8–10");
      expect(text).toContain("serves 16–20");
    } finally {
      view.unmount();
    }
  });

  it("offers nothing for a product priced by size with no headcount claimed", () => {
    /**
     * `serves` is optional per size. A shop selling cable by the metre prices
     * three lengths and claims no headcount for any of them — a "Serving Info"
     * link over an empty panel would be worse than no link.
     */
    const { html, unmount } = render({
      ...CAKE,
      weights: [
        { label: "1 m", price: 300 },
        { label: "2 m", price: 500 },
      ],
    } as never);
    try {
      expect(html).not.toContain("Serving Info");
    } finally {
      unmount();
    }
  });
});

describe("the two forms that used to stand open", () => {
  it("invites a question rather than opening a form nobody asked for", () => {
    const view = render(CAKE);
    try {
      expect(view.html).toContain("Ask us");
      // The form itself is behind it.
      expect(view.html).not.toContain("Your question");

      const ask = [...view.container.querySelectorAll("button")].find(
        (node) => node.textContent?.trim() === "Ask us",
      );
      act(() => {
        ask?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(view.container.textContent).toContain("Your question");
    } finally {
      view.unmount();
    }
  });

  it("does the same for the review form", () => {
    const view = render(CAKE);
    try {
      expect(view.html).toContain("Write a review");
      expect(view.html).not.toContain("Your review");

      const write = [...view.container.querySelectorAll("button")].find(
        (node) => node.textContent?.trim() === "Write a review",
      );
      act(() => {
        write?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(view.container.textContent).toContain("Your review");
    } finally {
      view.unmount();
    }
  });
});
