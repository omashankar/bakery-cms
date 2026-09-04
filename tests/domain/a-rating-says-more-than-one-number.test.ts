import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";

/**
 * A 4.2 made of forty fives and ten ones reads exactly like a 4.2 made of fifty
 * fours.
 *
 * The page carried one average and one count and nothing between them, and the
 * customer deciding whether to buy is the one who needs the difference. It also
 * had no way for a reader to say a review had helped them, so the most useful
 * review sat wherever its date put it.
 *
 * Every number in the summary is counted from the SAME rows the list renders —
 * no stored aggregate, nothing estimated — so the block and the reviews under it
 * cannot disagree.
 */

const approved: Array<Record<string, unknown>> = [];
const helpfulCalls: string[] = [];
const helpfulAnswer = { value: 7 as number | null };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => "/store/cakes/x",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/reviews/lib/reviews-api", () => ({
  fetchApprovedReviews: async () => approved,
  submitReview: async () => ({ ok: true }),
  submitReviewRequest: async () => null,
  markReviewHelpfulRequest: async (id: string) => {
    helpfulCalls.push(id);
    return helpfulAnswer.value;
  },
  reviewsHydration: { promise: Promise.resolve(), settle: () => undefined },
}));

const { ProductDetailPage } = await import("@/apps/website/pages/product-detail-page");

const PRODUCT = {
  id: "p-tee",
  name: "Cotton Tee",
  slug: "cotton-tee",
  description: "Soft cotton.",
  price: 800,
  image: "/tee.jpg",
  category: "Shirts",
  inStock: true,
  weights: [],
  shapes: [],
  variantGroups: [],
  rating: 4.2,
  reviewCount: 4,
};

function review(id: string, rating: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    authorName: `Reader ${id}`,
    rating,
    body: `Review ${id}`,
    createdAt: "2026-08-01T00:00:00.000Z",
    isFeatured: false,
    ...extra,
  };
}

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function render() {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      createElement(ProductDetailPage, {
        cake: PRODUCT,
        modules: defaultModuleSettings,
        related: [],
        catalog: [],
      } as never),
    );
  });
  return container;
}

/**
 * The summary block, found by what only it contains.
 *
 * `.bg-cream-50` matches the price panel further up the page, and a width
 * selector matches every progress-ish element in the document. Both of those
 * made an assertion pass, or fail, for reasons that had nothing to do with the
 * histogram.
 */
function summary() {
  return [...(container?.querySelectorAll("div") ?? [])].find(
    (node) => node.className.includes("bg-cream-50") && (node.textContent ?? "").includes("5 ★"),
  );
}

function press(text: string) {
  const button = [...(container?.querySelectorAll("button") ?? [])].find((node) =>
    (node.textContent ?? "").includes(text),
  );
  return button;
}

beforeEach(() => {
  window.localStorage.clear();
  approved.length = 0;
  helpfulCalls.length = 0;
  helpfulAnswer.value = 7;
});

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
});

describe("the shape of the ratings, not just their average", () => {
  it("counts each star from the reviews it is showing", async () => {
    approved.push(review("a", 5), review("b", 5), review("c", 5), review("d", 1));

    const summary = (await render()).textContent ?? "";

    // Four reviews: three fives and a one. 4.0, not the 4.2 stored on the
    // product — the bars and the number beside them come from the same rows.
    expect(summary).toContain("4");
    expect(summary).toContain("4 reviews");
    expect(summary).toContain("5 ★");
    expect(summary).toContain("1 ★");
  });

  it("draws each bar at the share that star actually has", async () => {
    approved.push(review("a", 5), review("b", 5), review("c", 4), review("d", 4));

    await render();
    /**
     * Read off the STAR ROWS, not off every element with a width.
     * `StarRating` sits in the same block and fills its stars with widths of
     * its own, so a blanket selector returned four 100%s and a 50% — a set of
     * numbers that looked like a histogram and was a picture of 4.5 stars.
     */
    const bars = [...(summary()?.querySelectorAll("div") ?? [])]
      // Anchored at both ends, so the wrapper holding all five rows — whose text
      // also begins "5 ★" — is not mistaken for the first row.
      .filter((node) => /^[1-5] ★\d+$/.test((node.textContent ?? "").trim()))
      .map((row) => (row.querySelector("span[style]") as HTMLElement | null)?.style.width);

    // Half and half, then nothing for the other three stars.
    expect(bars.slice(0, 5)).toEqual(["50%", "50%", "0%", "0%", "0%"]);
  });

  it("says nothing at all when nobody has reviewed it", async () => {
    const view = await render();

    expect(view.textContent).toContain("No published reviews yet");
    expect(view.textContent).not.toContain("5 ★");
  });

  it("reads the rows it renders, not the number stored on the product", async () => {
    /**
     * The product carries `rating: 4.2` from the server's aggregate. If the
     * summary read that while the bars counted the rows, a stale aggregate
     * would put a number on screen that its own histogram contradicts.
     */
    approved.push(review("a", 3), review("b", 3));

    await render();

    expect(summary()?.textContent).toContain("3");
    expect(summary()?.textContent).not.toContain("4.2");
  });
});

describe("saying a review helped", () => {
  it("counts the press and shows the number the server settled on", async () => {
    approved.push(review("a", 5));

    const view = await render();
    await act(async () => {
      press("Helpful")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(helpfulCalls).toEqual(["a"]);
    // The SERVER's number, not this browser's guess: two readers a second apart
    // must not each end up showing their own count.
    expect(view.textContent).toContain("7 people found this helpful");
  });

  it("will not let the same browser say it twice", async () => {
    approved.push(review("a", 5));

    await render();
    await act(async () => {
      press("Helpful")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const marked = press("Marked helpful");
    expect(marked).toBeTruthy();
    expect((marked as HTMLButtonElement).disabled).toBe(true);

    await act(async () => {
      marked?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(helpfulCalls).toEqual(["a"]);
  });

  it("counts one press when the button is hit twice before it can disable", async () => {
    /**
     * A double-tap, or a slow render. Both clicks land on a button that is
     * still enabled and read a `helpfulMarks` closure that is still empty, so
     * neither the disabled attribute nor a state check stops the second one.
     */
    approved.push(review("a", 5));

    await render();
    await act(async () => {
      const button = press("Helpful");
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(helpfulCalls).toEqual(["a"]);
  });

  it("writes the mark down, so a reload does not offer the button again", async () => {
    approved.push(review("a", 5));

    await render();
    await act(async () => {
      press("Helpful")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(
      JSON.parse(window.localStorage.getItem("bakery-cms-helpful-reviews") ?? "[]"),
    ).toEqual(["a"]);
  });

  it("remembers across a reload what this browser already marked", async () => {
    approved.push(review("a", 5));
    window.localStorage.setItem("bakery-cms-helpful-reviews", JSON.stringify(["a"]));

    const view = await render();

    expect(view.textContent).toContain("Marked helpful");
    expect(view.textContent).not.toContain(">Helpful<");
  });

  it("still counts the press when the request fails", async () => {
    // The reader has said what they think. Offering the button again would
    // invite them to say it twice for one opinion.
    approved.push(review("a", 5));
    helpfulAnswer.value = null;

    const view = await render();
    await act(async () => {
      press("Helpful")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(view.textContent).toContain("Marked helpful");
    expect(view.textContent).toContain("1 person found this helpful");
  });

  it("says nothing about a review nobody has marked", async () => {
    // "Helpful (0)" reads as a verdict on the review rather than an absence of
    // votes.
    approved.push(review("a", 5));

    expect((await render()).textContent).not.toContain("found this helpful");
  });

  it("shows the count a review already carries", async () => {
    approved.push(review("a", 5, { helpfulCount: 3 }));

    expect((await render()).textContent).toContain("3 people found this helpful");
  });
});
