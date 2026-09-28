import { describe, expect, it } from "vitest";

import { paginationWindow } from "@/apps/website/pages/collections-page";

/**
 * A PAGE LIST THAT GROWS WITH THE CATALOGUE IS NOT A PAGE LIST.
 *
 * The listing page drew `Array.from({ length: totalPages })` — one anchor per
 * page. At eight per page and twenty-seven products that is four numbers and
 * looks fine, which is exactly why it survived. At twenty-four per page and
 * three thousand products it is 125 anchors wrapping five lines, and the shop
 * has said in as many words that this page must be built for the catalogue
 * they are going to have rather than the one they have.
 *
 * ASSERTED BY RETURN VALUE, not by counting anchors in a rendered page — that
 * is the check that passes for a component which computes a window and then
 * renders every page anyway.
 */
describe("the page numbers a customer is offered", () => {
  it("draws every page while they still fit on one line", () => {
    expect(paginationWindow(1, 1)).toEqual([1]);
    expect(paginationWindow(4, 2)).toEqual([1, 2, 3, 4]);
    // Seven is the last count with no gap in it.
    expect(paginationWindow(7, 4)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("and elides the middle once they do not", () => {
    /*
      The shape, not the exact run: first, last, the current page with a
      neighbour either side, and `null` wherever the sequence breaks.
    */
    const middle = paginationWindow(20, 10);
    expect(middle[0]).toBe(1);
    expect(middle[middle.length - 1]).toBe(20);
    expect(middle).toContain(9);
    expect(middle).toContain(10);
    expect(middle).toContain(11);
    expect(middle).toContain(null);
  });

  it("never draws more slots than it promises, at any catalogue size", () => {
    /*
      THE ONE THAT CANNOT PASS VACUOUSLY. Walked over every cursor position on
      a 125-page list — the size this is sold to run — so a window that is
      correct in the middle and unbounded at an end still fails here.
    */
    for (let here = 1; here <= 125; here += 1) {
      const slots = paginationWindow(125, here);
      expect(slots.length, `page ${here} draws ${slots.length} slots`).toBeLessThanOrEqual(9);
      expect(slots[0], `page ${here} loses its way home`).toBe(1);
      expect(slots[slots.length - 1], `page ${here} loses the last page`).toBe(125);
      expect(slots, `page ${here} is not in its own list`).toContain(here);
    }
  });

  it("keeps its width when the cursor is at an end", () => {
    /*
      Without this the control shrinks from seven slots to five as a customer
      walks to page two, and the numbers move under the pointer.
    */
    expect(paginationWindow(50, 1).length).toBeGreaterThanOrEqual(6);
    expect(paginationWindow(50, 50).length).toBeGreaterThanOrEqual(6);
  });

  it("and survives a page number that is not one", () => {
    // `currentPage` is clamped upstream, but a pure function that throws on a
    // stale value takes the page down rather than mis-drawing a control.
    expect(paginationWindow(10, 0)[0]).toBe(1);
    expect(paginationWindow(10, 99)).toContain(10);
    expect(paginationWindow(0, 1)).toEqual([1]);
    expect(paginationWindow(Number.NaN, Number.NaN)).toEqual([1]);
  });
});
