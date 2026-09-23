import { describe, expect, it } from "vitest";

import { frameShape, type FramePainter } from "@/lib/images/photo-print-layout";

/**
 * A HEART IS THE ONE SHAPE IN THIS LIST NOBODY CAN CHECK BY READING IT.
 *
 * Five of the six frames are a single `rect`. The heart is six cubic curves and
 * twenty-four hand-written numbers, and it shipped with one of them two
 * forty-fourths out of place: the notch between the lobes leaned two per cent
 * of the frame's width — eleven pixels at the size it is actually drawn — and
 * it survived review, a unit suite and a browser suite, because every one of
 * those asked whether a heart was drawn and none asked whether it was straight.
 *
 * So these read the numbers the way an eye does. The outline is traced into a
 * recorder, the curves are sampled, and each half is compared with the other
 * half read backwards and flipped. That is a claim about the drawing rather
 * than about the source: swapping a digit fails it, and so does replacing the
 * whole path with a different lopsided one.
 */

type Point = [number, number];
type Curve = { from: Point; cp1: Point; cp2: Point; to: Point };

/** Trace a shape and keep the geometry, which the shared recorder discards. */
function trace(id: string, width: number, height: number) {
  const moves: Point[] = [];
  const curves: Curve[] = [];
  let at: Point = [0, 0];
  let closed = false;

  const painter = {
    moveTo: (x: number, y: number) => {
      at = [x, y];
      moves.push(at);
    },
    bezierCurveTo: (c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) => {
      curves.push({ from: at, cp1: [c1x, c1y], cp2: [c2x, c2y], to: [x, y] });
      at = [x, y];
    },
    closePath: () => {
      closed = true;
    },
    rect: () => {},
    arc: () => {},
  };

  frameShape(id).outline(painter as unknown as FramePainter, width, height);
  return { moves, curves, closed };
}

const on = (c: Curve, t: number): Point => {
  const u = 1 - t;
  const axis = (i: 0 | 1) =>
    u * u * u * c.from[i] + 3 * u * u * t * c.cp1[i] + 3 * u * t * t * c.cp2[i] + t * t * t * c.to[i];
  return [axis(0), axis(1)];
};

function outlinePoints(curves: Curve[], steps = 300): Point[] {
  const points: Point[] = [];
  for (const curve of curves) {
    for (let i = 0; i <= steps; i++) points.push(on(curve, i / steps));
  }
  return points;
}

describe("the heart is the same on both sides", () => {
  const SIZE = 1000;

  it("is drawn as six curves that close on the notch they started from", () => {
    const { moves, curves, closed } = trace("heart", SIZE, SIZE);

    expect(moves, "the heart should open with exactly one moveTo").toHaveLength(1);
    expect(curves, "the heart is six cubic segments").toHaveLength(6);
    expect(closed, "an unclosed heart is closed by a straight line across the notch").toBe(true);

    const end = curves[curves.length - 1]!.to;
    expect(end[0]).toBeCloseTo(moves[0]![0], 6);
    expect(end[1]).toBeCloseTo(moves[0]![1], 6);
  });

  it("mirrors curve for curve down its middle", () => {
    const { curves } = trace("heart", SIZE, SIZE);

    /*
      Curve 1 pairs with 6, 2 with 5, 3 with 4 — each the other read backwards
      with x flipped. Sampled rather than compared as control points, because
      two different sets of control points can draw the same curve and it is the
      curve a customer looks at.
    */
    const pairs: [number, number, string][] = [
      [0, 5, "the notch between the lobes"],
      [1, 4, "the outer shoulder of each lobe"],
      [2, 3, "the side running down to the point"],
    ];

    for (const [left, right, what] of pairs) {
      let worst = 0;
      let where = "";
      for (let i = 0; i <= 200; i++) {
        const t = i / 200;
        const [ax, ay] = on(curves[left]!, t);
        const [bx, by] = on(curves[right]!, 1 - t);
        const off = Math.hypot(ax - (SIZE - bx), ay - by);
        if (off > worst) {
          worst = off;
          where = `at ${(t * 100).toFixed(0)}% along: left (${ax.toFixed(1)}, ${ay.toFixed(1)}), right flipped (${(SIZE - bx).toFixed(1)}, ${by.toFixed(1)})`;
        }
      }
      expect(
        worst,
        `${what} leans ${((worst / SIZE) * 100).toFixed(2)}% of the frame — ${where}`,
      ).toBeLessThan(SIZE * 0.002);
    }
  });

  it("fills the box it is handed, edge to edge", () => {
    /*
      A heart that does not touch all four sides is a heart with a margin the
      shop did not ask for, printed smaller than the frame it was sold in.
    */
    const { curves } = trace("heart", SIZE, SIZE);
    const points = outlinePoints(curves);
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);

    expect(Math.min(...xs)).toBeCloseTo(0, 3);
    expect(Math.max(...xs)).toBeCloseTo(SIZE, 3);
    expect(Math.min(...ys)).toBeCloseTo(0, 3);
    expect(Math.max(...ys)).toBeCloseTo(SIZE, 3);
  });

  it("dips into a notch at the top and comes to a point at the bottom", () => {
    /*
      WITHOUT THIS IT IS A LEAF. The two claims above are both satisfied by a
      shape with a flat top, so this asks for the two things that make the
      outline read as a heart at all: the middle of the top edge is a notch cut
      DOWN into the shape, and the bottom is a single point rather than a base.
    */
    const { moves, curves } = trace("heart", SIZE, SIZE);
    const points = outlinePoints(curves);

    const notch = moves[0]!;
    expect(notch[0], "the notch is on the centre line").toBeCloseTo(SIZE / 2, 3);
    expect(notch[1], "the notch does not dip below the top edge").toBeGreaterThan(SIZE * 0.04);
    expect(notch[1], "the notch is a notch, not a cleavage down to the waist").toBeLessThan(
      SIZE * 0.3,
    );

    /* Two lobes, so the top edge is reached twice, on either side of the notch. */
    const onTop = points.filter((p) => p[1] < SIZE * 0.001);
    expect(onTop.some((p) => p[0] < SIZE * 0.45), "there is no left lobe").toBe(true);
    expect(onTop.some((p) => p[0] > SIZE * 0.55), "there is no right lobe").toBe(true);

    /* And the bottom is one point on the centre line, not a flat base. */
    const atBottom = points.filter((p) => p[1] > SIZE * 0.999);
    const spread = Math.max(...atBottom.map((p) => p[0])) - Math.min(...atBottom.map((p) => p[0]));
    expect(spread, `the heart sits on a ${spread.toFixed(0)}px base instead of a point`).toBeLessThan(
      SIZE * 0.05,
    );
    for (const point of atBottom) expect(point[0]).toBeCloseTo(SIZE / 2, 0);
  });

  it("scales with the box rather than assuming a square one", () => {
    /*
      The heart is only offered at 1:1 today. It is written as fractions of
      width and height regardless, and this holds that: a shop that is given a
      heart in some other proportion gets a stretched heart, not a square one
      floating in a wide box with the point off the bottom.
    */
    const { curves } = trace("heart", 800, 400);
    const points = outlinePoints(curves);
    expect(Math.max(...points.map((p) => p[0]))).toBeCloseTo(800, 3);
    expect(Math.max(...points.map((p) => p[1]))).toBeCloseTo(400, 3);
  });
});
