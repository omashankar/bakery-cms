import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PhotoPrintEditor } from "@/components/storefront/photo-print-editor";
import { Slider } from "@/components/ui/slider";
import {
  charactersLeft,
  emptyPhotoPrintDraft,
  frameShape,
  frameSize,
  PHOTO_FRAME_SHAPES,
  NAME_LIMIT,
  namePlacement,
  OUTPUT_PX,
  paintPhotoFrame,
  PREVIEW_PX,
  photoFileProblem,
  photoPlacement,
  type FramePainter,
  type PhotoPrintDraft,
} from "@/lib/images/photo-print-layout";

/**
 * The photograph a customer wants printed, and the fact that they can now see
 * what will be.
 *
 * The control was a file input. Whatever the camera produced went to the shop
 * at whatever crop, and the print area is ROUND — so a rectangular photograph
 * lost its corners to whoever was standing at the printer, and the only person
 * who knows which corners are expendable was never asked.
 *
 * Two things in here are worth testing and one of them is not the drawing. The
 * first is that the preview and the printed file are the SAME PICTURE: they are
 * painted at 512 and 1600 pixels by one function, and the moment those two
 * disagree a customer centres a face, presses the button, and the shop prints
 * something else. The second is that a name typed is a name printed — there is
 * no Set button to forget, and no styling record travelling through the nine
 * hand-written field lists between this page and a saved order, because the
 * lettering is flattened into the image before it leaves the browser.
 */

/** A square frame of side n, which is what most of these cases want. */
const box = (side: number) => ({ width: side, height: side });
/** …and the round outline inside it, the shape a product has by default. */
const round = (side: number) => ({ ...box(side), shape: frameShape("circle") });

const ADMIN_FORM = "apps/admin/products/components/product-form-page.tsx";
const MODULES_PAGE = "apps/admin/settings/components/modules-settings-page.tsx";

const SQUARE = { width: 1000, height: 1000 };
const LANDSCAPE = { width: 2000, height: 1000 };
const PORTRAIT = { width: 1000, height: 2500 };

describe("fitting a photograph to a round frame", () => {
  it("fills the frame at rest, whatever shape the photo is", () => {
    /**
     * COVER, not contain. Containing a portrait photograph inside a circle
     * letterboxes it — two white crescents and a small picture — and would make
     * the zoom slider the only route to a normal result.
     */
    const frame = 400;
    for (const image of [SQUARE, LANDSCAPE, PORTRAIT]) {
      const placed = photoPlacement(image, box(frame), emptyPhotoPrintDraft);
      expect(Math.min(placed.width, placed.height)).toBeCloseTo(frame, 6);
      expect(Math.max(placed.width, placed.height)).toBeGreaterThanOrEqual(frame);
    }
  });

  it("keeps the photograph's own proportions", () => {
    // A face squashed to fit is worse than a face cropped to fit.
    const placed = photoPlacement(LANDSCAPE, box(400), emptyPhotoPrintDraft);
    expect(placed.width / placed.height).toBeCloseTo(2, 6);
  });

  it("zooms from the fitted size, not from the pixel size", () => {
    const one = photoPlacement(PORTRAIT, box(400), emptyPhotoPrintDraft);
    const two = photoPlacement(PORTRAIT, box(400), { ...emptyPhotoPrintDraft, zoom: 2 });
    expect(two.width).toBeCloseTo(one.width * 2, 6);
    expect(two.height).toBeCloseTo(one.height * 2, 6);
  });

  it("moves the photograph by half the frame at each end of the slider", () => {
    const frame = 400;
    const right = photoPlacement(SQUARE, box(frame), { ...emptyPhotoPrintDraft, offsetX: 1 });
    const down = photoPlacement(SQUARE, box(frame), { ...emptyPhotoPrintDraft, offsetY: -1 });

    expect(right.centreX).toBeCloseTo(frame / 2 + frame / 2, 6);
    expect(right.centreY).toBeCloseTo(frame / 2, 6);
    expect(down.centreY).toBeCloseTo(0, 6);
  });

  it("turns degrees into radians the way a canvas wants them", () => {
    expect(
      photoPlacement(SQUARE, box(400), { ...emptyPhotoPrintDraft, rotation: 90 }).radians,
    ).toBeCloseTo(Math.PI / 2, 9);
  });

  it("answers zero rather than NaN for an image with no size", () => {
    // Reachable: a file that decodes to nothing, and a stub in a test. NaN would
    // reach `drawImage` and silently paint an empty frame with no error.
    const placed = photoPlacement({ width: 0, height: 0 }, box(400), emptyPhotoPrintDraft);
    expect(placed.width).toBe(0);
    expect(Number.isNaN(placed.height)).toBe(false);
  });
});

describe("the preview is the printed file, drawn smaller", () => {
  /**
   * THE one that matters.
   *
   * The customer nudges a face into the middle of a 512-pixel circle and the
   * shop is sent a 1600-pixel one. If the two are computed differently — or the
   * same maths is copied into two places and one of them is edited — the
   * printed cake is not the picture anybody agreed to.
   */
  const busy: PhotoPrintDraft = {
    ...emptyPhotoPrintDraft,
    zoom: 1.85,
    offsetX: -0.4,
    offsetY: 0.25,
    rotation: 17,
    name: "Manisha",
    nameSize: 0.14,
    nameX: 0.3,
    nameY: -0.2,
    nameRotation: -8,
  };

  const ratio = OUTPUT_PX / 512;

  it("places the photograph at the same fraction of either frame", () => {
    const small = photoPlacement(PORTRAIT, box(512), busy);
    const large = photoPlacement(PORTRAIT, box(OUTPUT_PX), busy);

    expect(large.centreX).toBeCloseTo(small.centreX * ratio, 6);
    expect(large.centreY).toBeCloseTo(small.centreY * ratio, 6);
    expect(large.width).toBeCloseTo(small.width * ratio, 6);
    expect(large.height).toBeCloseTo(small.height * ratio, 6);
    expect(large.radians).toBeCloseTo(small.radians, 9);
  });

  it("places the lettering at the same fraction of either frame", () => {
    const small = namePlacement(box(512), busy);
    const large = namePlacement(box(OUTPUT_PX), busy);

    expect(large.x).toBeCloseTo(small.x * ratio, 6);
    expect(large.y).toBeCloseTo(small.y * ratio, 6);
    expect(large.fontSize).toBeCloseTo(small.fontSize * ratio, 6);
    expect(large.radians).toBeCloseTo(small.radians, 9);
  });
});

describe("how the name is set", () => {
  it("sizes the lettering against the frame, not in fixed points", () => {
    // 14pt is a caption on the preview and a speck on the printed sheet.
    expect(namePlacement(box(400), { ...emptyPhotoPrintDraft, nameSize: 0.1 }).fontSize).toBeCloseTo(40);
  });

  it("says bold and italic in the one string a canvas understands", () => {
    const plain = namePlacement(box(400), { ...emptyPhotoPrintDraft, bold: false, italic: false }).font;
    const both = namePlacement(box(400), { ...emptyPhotoPrintDraft, bold: true, italic: true }).font;

    expect(plain).toContain("400 ");
    expect(plain).not.toContain("italic");
    expect(both).toContain("italic");
    expect(both).toContain("700 ");
  });

  it("moves the lettering by half the frame at each end of the slider", () => {
    // The same units as the photo sliders, so the two halves of this editor
    // do not need learning separately.
    const frame = 400;
    expect(namePlacement(box(frame), { ...emptyPhotoPrintDraft, nameX: 1, nameY: 0 }).x).toBeCloseTo(
      400,
      6,
    );
    expect(namePlacement(box(frame), { ...emptyPhotoPrintDraft, nameX: 0, nameY: -1 }).y).toBeCloseTo(
      0,
      6,
    );
    expect(namePlacement(box(frame), { ...emptyPhotoPrintDraft, nameX: 0, nameY: 0 }).x).toBeCloseTo(
      200,
      6,
    );
  });

  it("tilts the lettering by the degrees the slider says", () => {
    expect(
      namePlacement(box(400), { ...emptyPhotoPrintDraft, nameRotation: -90 }).radians,
    ).toBeCloseTo(-Math.PI / 2, 9);
  });

  it("names only families the browser already has", () => {
    /**
     * A webfont still loading paints the FALLBACK into the file, and nobody
     * finds out until it is printed. A canvas draws with what is there now.
     *
     * Every family is checked, not just the tail: `toContain("serif")` passed
     * for `"Great Vibes", cursive, serif` — which is precisely the webfont
     * this is here to keep out.
     */
    const shipped = ["Georgia", '"Times New Roman"', "serif"];
    const families = namePlacement(box(400), emptyPhotoPrintDraft)
      .font.replace(/^.*?\d+(?:\.\d+)?px /, "")
      .split(",")
      .map((family) => family.trim());

    expect(families.length).toBeGreaterThan(0);
    for (const family of families) expect(shipped).toContain(family);
  });

  it("counts down to the frame's limit and stops at nothing left", () => {
    expect(charactersLeft("")).toBe(NAME_LIMIT);
    expect(charactersLeft("Manisha")).toBe(NAME_LIMIT - 7);
    expect(charactersLeft("x".repeat(NAME_LIMIT + 10))).toBe(0);
  });
});

describe("which files a customer may choose", () => {
  it("takes an ordinary photograph", () => {
    expect(photoFileProblem({ size: 3_000_000, type: "image/jpeg" })).toBeNull();
    expect(photoFileProblem({ size: 500, type: "image/png" })).toBeNull();
    expect(photoFileProblem({ size: 500, type: "image/webp" })).toBeNull();
  });

  it("refuses an empty file", () => {
    expect(photoFileProblem({ size: 0, type: "image/jpeg" })).toContain("empty");
  });

  it("refuses one too large to open on a phone", () => {
    expect(photoFileProblem({ size: 40 * 1024 * 1024, type: "image/jpeg" })).toContain("20 MB");
  });

  it("allows a file the browser could not name", () => {
    /**
     * Some phones and file managers hand over a File with no type at all.
     * Refusing those turns a working photograph into "wrong format" for a
     * reason the customer can neither see nor fix — and the server sniffs the
     * real bytes regardless.
     */
    expect(photoFileProblem({ size: 1000, type: "" })).toBeNull();
  });

  it("refuses something that is not one of the three the shop can print", () => {
    expect(photoFileProblem({ size: 1000, type: "image/svg+xml" })).toContain("JPEG");
    expect(photoFileProblem({ size: 1000, type: "application/pdf" })).toContain("JPEG");
  });
});

describe("what gets painted, and in what order", () => {
  /** A painter that writes down what it was told, since jsdom has no canvas. */
  function recorder() {
    const calls: string[] = [];
    const painter = {
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      beginPath: () => calls.push("beginPath"),
      arc: (x: number, y: number, r: number) => calls.push(`arc:${x},${y},${r}`),
      rect: (x: number, y: number, w: number, h: number) => calls.push(`rect:${x},${y},${w},${h}`),
      moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
      lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
      quadraticCurveTo: () => calls.push("quad"),
      bezierCurveTo: () => calls.push("bezier"),
      closePath: () => calls.push("closePath"),
      stroke: () => calls.push("stroke"),
      clip: () => calls.push("clip"),
      translate: (x: number, y: number) => calls.push(`translate:${x},${y}`),
      rotate: (a: number) => calls.push(`rotate:${a.toFixed(4)}`),
      fillRect: (x: number, y: number, w: number, h: number) =>
        calls.push(`fillRect:${x},${y},${w},${h}`),
      drawImage: (_i: never, dx: number, dy: number, dw: number, dh: number) =>
        calls.push(`drawImage:${dx.toFixed(1)},${dy.toFixed(1)},${dw.toFixed(1)},${dh.toFixed(1)}`),
      fillText: (text: string) => calls.push(`fillText:${text}`),
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      font: "",
      textAlign: "start" as CanvasTextAlign,
      textBaseline: "alphabetic" as CanvasTextBaseline,
    };
    return { painter: painter as unknown as FramePainter, calls, state: painter };
  }

  const at = (calls: string[], prefix: string) => calls.findIndex((c) => c.startsWith(prefix));

  it("lays a white ground before it clips, so the corners are printable", () => {
    /**
     * The file is a JPEG and has no transparency to offer. The corners outside
     * the circle are not "nothing", they are the part of the sheet that does
     * not get printed — and white is what that is.
     */
    const { painter, calls, state } = recorder();
    paintPhotoFrame(painter, round(400), SQUARE, emptyPhotoPrintDraft);

    expect(calls).toContain("fillRect:0,0,400,400");
    expect(at(calls, "fillRect")).toBeLessThan(at(calls, "clip"));
    expect(state.fillStyle).not.toBe("");
  });

  it("clips to the circle the frame contains", () => {
    const { painter, calls } = recorder();
    paintPhotoFrame(painter, round(400), SQUARE, emptyPhotoPrintDraft);

    expect(calls).toContain("arc:200,200,200");
    expect(at(calls, "arc")).toBeLessThan(at(calls, "clip"));
    // …and everything painted after it is inside that clip.
    expect(at(calls, "clip")).toBeLessThan(at(calls, "drawImage"));
  });

  it("draws the photograph centred on its own middle", () => {
    const { painter, calls } = recorder();
    paintPhotoFrame(painter, round(400), LANDSCAPE, emptyPhotoPrintDraft);

    expect(calls).toContain("translate:200,200");
    // 2000x1000 covering a 400 frame is 800x400, drawn from -400,-200.
    expect(calls).toContain("drawImage:-400.0,-200.0,800.0,400.0");
  });

  it("still paints a frame when no photograph has been chosen", () => {
    // The dialog opens before anything is picked, and an unpainted canvas is a
    // grey rectangle that reads as broken.
    const { painter, calls } = recorder();
    paintPhotoFrame(painter, round(400), null, emptyPhotoPrintDraft);

    expect(calls).toContain("fillRect:0,0,400,400");
    expect(at(calls, "drawImage")).toBe(-1);
  });

  it("puts the lettering over the photograph, not under it", () => {
    const { painter, calls } = recorder();
    paintPhotoFrame(painter, round(400), SQUARE, { ...emptyPhotoPrintDraft, name: "Manisha" });

    expect(calls).toContain("fillText:Manisha");
    expect(at(calls, "drawImage")).toBeLessThan(at(calls, "fillText"));
  });

  it("writes nothing at all when no name was typed", () => {
    const { painter, calls } = recorder();
    paintPhotoFrame(painter, round(400), SQUARE, { ...emptyPhotoPrintDraft, name: "   " });

    expect(at(calls, "fillText")).toBe(-1);
  });

  it("uses the colour the customer picked", () => {
    const { painter, state } = recorder();
    paintPhotoFrame(painter, round(400), SQUARE, {
      ...emptyPhotoPrintDraft,
      name: "Manisha",
      colour: "#123456",
    });

    // Last write wins, and the lettering is painted last.
    expect(state.fillStyle).toBe("#123456");
    expect(state.textAlign).toBe("center");
  });
});

describe("the editor a customer opens", () => {
  beforeAll(() => {
    // jsdom implements no canvas; the component is written to carry on without
    // one rather than throw, and this is what proves it.
    HTMLCanvasElement.prototype.getContext = () => null;
    // …and no object URLs either. The component only ever hands these to an
    // <img> jsdom will not load, so a counter is enough to keep it honest
    // about revoking what it made.
    URL.createObjectURL = () => "blob:test";
    URL.revokeObjectURL = () => {};
  });

  const mounted: Array<() => void> = [];
  afterEach(() => {
    while (mounted.length) mounted.pop()?.();
  });

  function open(overrides: Partial<Parameters<typeof PhotoPrintEditor>[0]> = {}) {
    const onUse = vi.fn();
    const onProblem = vi.fn();
    const onFileChange = vi.fn();
    const onDraftChange = vi.fn();
    const onOpenChange = vi.fn();

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        createElement(PhotoPrintEditor, {
          open: true,
          onOpenChange,
          file: null,
          onFileChange,
          draft: emptyPhotoPrintDraft,
          onDraftChange,
          busy: false,
          onUse,
          onProblem,
          ...overrides,
        }),
      );
    });

    let gone = false;
    const unmount = () => {
      if (gone) return;
      gone = true;
      act(() => {
        root.unmount();
      });
      container.remove();
    };
    mounted.push(unmount);

    const dialog = () => document.body.querySelector<HTMLElement>("[role='dialog']");
    const button = (text: string) =>
      [...(dialog()?.querySelectorAll("button") ?? [])].find(
        (element) => element.textContent?.trim() === text,
      );

    return { dialog, button, unmount, onUse, onProblem, onFileChange, onDraftChange, onOpenChange };
  }

  const click = (element: Element | undefined) => {
    act(() => {
      element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  it("says what it is for", () => {
    const view = open();
    expect(view.dialog()?.textContent).toContain("Fit your photo in the frame");
  });

  it("will not hand over a frame with no photograph in it", () => {
    /**
     * The reference lets Continue through with an empty circle. What reaches
     * the shop then is a white disc, and an order that says a photo is attached.
     */
    const view = open();
    const use = view.button("Use this photo");

    expect(use?.hasAttribute("disabled")).toBe(true);
    click(use);
    expect(view.onUse).not.toHaveBeenCalled();
  });

  it("offers the two things a customer came here to do", () => {
    const view = open();
    const tabs = [...(view.dialog()?.querySelectorAll("[role='tab']") ?? [])].map((tab) =>
      tab.textContent?.trim(),
    );
    expect(tabs).toEqual(["Photo", "Name"]);
  });

  it("counts the characters left as the name is typed", () => {
    const view = open({ draft: { ...emptyPhotoPrintDraft, name: "Manisha" } });
    const name = [...(view.dialog()?.querySelectorAll("[role='tab']") ?? [])].find(
      (tab) => tab.textContent?.trim() === "Name",
    );
    click(name);

    expect(view.dialog()?.textContent).toContain(`${NAME_LIMIT - 7} characters left`);
  });

  it("takes what is typed with no Set button to forget", () => {
    /**
     * The reference has one, and a customer who types a name, does not press
     * it, and presses Continue gets a frame with no name on it and no idea
     * why. Nothing here has to be confirmed twice.
     */
    const view = open();
    const name = [...(view.dialog()?.querySelectorAll("[role='tab']") ?? [])].find(
      (tab) => tab.textContent?.trim() === "Name",
    );
    click(name);

    expect(view.button("Set")).toBeUndefined();

    const input = view.dialog()?.querySelector<HTMLInputElement>("#print-name");
    expect(input).not.toBeNull();
    act(() => {
      Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set?.call(input, "Anaya");
      input?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    expect(view.onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Anaya" }),
    );
  });

  it("caps the name at what the frame will take", () => {
    const view = open();
    const name = [...(view.dialog()?.querySelectorAll("[role='tab']") ?? [])].find(
      (tab) => tab.textContent?.trim() === "Name",
    );
    click(name);

    expect(
      view.dialog()?.querySelector<HTMLInputElement>("#print-name")?.maxLength,
    ).toBe(NAME_LIMIT);
  });

  it("closes on Cancel without touching the photo already attached", () => {
    /**
     * Cancel means "leave it as it was". Clearing the stored photo here would
     * delete a customer's earlier upload because they opened the editor to look
     * at it — and the photo is part of the cart line's identity, so it would
     * also split the line they were editing.
     */
    const view = open();
    click(view.button("Cancel"));

    expect(view.onOpenChange).toHaveBeenCalledWith(false);
    expect(view.onFileChange).not.toHaveBeenCalled();
    expect(view.onUse).not.toHaveBeenCalled();
  });

  it("shows the photo that is already attached, when nothing new is chosen", () => {
    /**
     * Only the UPLOADED frame survives leaving this page — not the original
     * file, not where the sliders were. So somebody who presses Change on a
     * line they saved opens this on an empty circle while the button behind
     * it says a photo is attached, and without this it reads as a loss.
     */
    const view = open({ attachedUrl: "https://cdn.example/already.jpg" });
    expect(view.dialog()?.textContent).toContain("A photo is already attached");
  });

  it("stops saying that the moment a new photograph is chosen", () => {
    const view = open({
      attachedUrl: "https://cdn.example/already.jpg",
      file: new File(["x"], "new.jpg", { type: "image/jpeg" }),
    });
    expect(view.dialog()?.textContent).not.toContain("A photo is already attached");
  });

  it("gives back every object URL it made for a photograph", () => {
    /**
     * One blob URL per photograph somebody changed their mind about, held
     * for as long as the tab is open. Nothing visible goes wrong — which is
     * exactly why it would never be found without this.
     */
    const made: string[] = [];
    const freed: string[] = [];
    URL.createObjectURL = () => {
      const url = `blob:${made.length}`;
      made.push(url);
      return url;
    };
    URL.revokeObjectURL = (url: string) => void freed.push(url);

    const view = open({ file: new File(["x"], "a.jpg", { type: "image/jpeg" }) });
    expect(made).toHaveLength(1);
    expect(freed).toHaveLength(0);

    view.unmount();
    expect(freed).toEqual(made);
  });

  it("says so while the shop is being sent the frame", () => {
    const view = open({ busy: true });
    expect(view.button("Sending…")?.hasAttribute("disabled")).toBe(true);
  });
});

/**
 * The two things the customer is promised, exercised rather than reasoned about.
 *
 * The block above tests the arithmetic; nothing tested the CALL SITES, and the
 * suite stayed green through both of the mutations that break this feature
 * completely: painting the export at preview size, and never calling `onUse` at
 * all. A recording canvas is what closes that, and it doubles as the only way
 * to see the preview go blank on reopen.
 */
describe("what is painted, on which canvas, and what leaves for the shop", () => {
  interface Paint {
    /** The backing store the paint went to, read at the moment it started. */
    width: number;
    height: number;
    calls: string[];
  }

  let paints: Paint[] = [];
  /** One entry per `new Image()` whose src was set, waiting to be resolved. */
  let decodes: Array<{ ok: () => void; fail: () => void }> = [];

  const realGetContext = HTMLCanvasElement.prototype.getContext;
  const realToBlob = HTMLCanvasElement.prototype.toBlob;
  const realImage = globalThis.Image;

  function recorder(calls: string[]) {
    return {
      save: () => calls.push("save"),
      restore: () => calls.push("restore"),
      beginPath: () => calls.push("beginPath"),
      arc: (x: number, y: number, r: number) => calls.push(`arc:${x},${y},${r}`),
      rect: (x: number, y: number, w: number, h: number) => calls.push(`rect:${x},${y},${w},${h}`),
      moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
      lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
      quadraticCurveTo: () => calls.push("quad"),
      bezierCurveTo: () => calls.push("bezier"),
      closePath: () => calls.push("closePath"),
      stroke: () => calls.push("stroke"),
      clip: () => calls.push("clip"),
      translate: (x: number, y: number) => calls.push(`translate:${x},${y}`),
      rotate: (a: number) => calls.push(`rotate:${a.toFixed(4)}`),
      fillRect: (x: number, y: number, w: number, h: number) =>
        calls.push(`fillRect:${x},${y},${w},${h}`),
      drawImage: (_i: unknown, dx: number, dy: number, dw: number, dh: number) =>
        calls.push(`drawImage:${dx.toFixed(1)},${dy.toFixed(1)},${dw.toFixed(1)},${dh.toFixed(1)}`),
      fillText: (text: string) => calls.push(`fillText:${text}`),
      fillStyle: "",
      strokeStyle: "",
      lineWidth: 0,
      font: "",
      textAlign: "start",
      textBaseline: "alphabetic",
    };
  }

  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
      const paint: Paint = { width: this.width, height: this.height, calls: [] };
      paints.push(paint);
      return recorder(paint.calls);
    } as never;

    HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback, type?: string) {
      callback(new Blob(["jpeg-ish"], { type: type ?? "image/png" }));
    };

    /**
     * jsdom never loads an image, so decoding is driven by hand.
     *
     * Holding the resolver rather than firing it is what makes the
     * replaced-photograph case testable at all: there is a real window in which
     * a new file is chosen and its bitmap does not exist yet.
     */
    globalThis.Image = class {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      width = 1200;
      height = 900;
      set src(_value: string) {
        decodes.push({ ok: () => this.onload?.(), fail: () => this.onerror?.() });
      }
    } as never;
  });

  afterAll(() => {
    HTMLCanvasElement.prototype.getContext = realGetContext;
    HTMLCanvasElement.prototype.toBlob = realToBlob;
    globalThis.Image = realImage;
  });

  const living: Array<() => void> = [];
  beforeEach(() => {
    paints = [];
    decodes = [];
  });
  afterEach(() => {
    while (living.length) living.pop()?.();
  });

  const photo = () => new File(["x"], "holiday.jpg", { type: "image/jpeg" });

  function mount(props: Record<string, unknown> = {}) {
    const onUse = vi.fn();
    const onProblem = vi.fn();
    const onFileChange = vi.fn();
    const onDraftChange = vi.fn();
    const onOpenChange = vi.fn();

    let current: Record<string, unknown> = {
      open: true,
      file: null,
      draft: emptyPhotoPrintDraft,
      busy: false,
      onUse,
      onProblem,
      onFileChange,
      onDraftChange,
      onOpenChange,
      ...props,
    };

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    const draw = () => {
      act(() => {
        root.render(createElement(PhotoPrintEditor, current as never));
      });
    };
    draw();

    let gone = false;
    living.push(() => {
      if (gone) return;
      gone = true;
      act(() => {
        root.unmount();
      });
      container.remove();
    });

    const dialog = () => document.body.querySelector<HTMLElement>("[role='dialog']");
    return {
      dialog,
      onUse,
      onProblem,
      onFileChange,
      onDraftChange,
      onOpenChange,
      rerender(next: Record<string, unknown>) {
        current = { ...current, ...next };
        draw();
      },
      button: (text: string) =>
        [...(dialog()?.querySelectorAll("button") ?? [])].find(
          (element) => element.textContent?.trim() === text,
        ),
      picker: () => dialog()?.querySelector<HTMLInputElement>("input[type='file']"),
    };
  }

  const decode = async () => {
    await act(async () => {
      decodes.splice(0).forEach((entry) => entry.ok());
    });
  };

  const press = async (element: Element | undefined) => {
    await act(async () => {
      element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  };

  const pick = (view: ReturnType<typeof mount>, file: File) => {
    const input = view.picker();
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    /**
     * The clear is COUNTED, not read back.
     *
     * A file input's value is already "" in jsdom, so asserting it afterwards
     * passes whether or not the handler cleared anything — a test that cannot
     * fail for the thing it names.
     */
    let cleared = 0;
    Object.defineProperty(input, "value", {
      configurable: true,
      get: () => "",
      set: (next: string) => void (next === "" && (cleared += 1)),
    });
    act(() => {
      input?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return { input, cleared: () => cleared };
  };

  it("paints every canvas at the size that canvas actually is", async () => {
    /**
     * THE assertion this whole file exists for, and the one it did not have.
     *
     * The parity block above only proves the two pure functions are
     * proportional in their own argument — neither call site is forced to use
     * them right. Painting the export at preview size left the suite green
     * while shipping the shop a 2400px file with a 512px circle in one corner.
     */
    const view = mount({ file: photo(), draft: { ...emptyPhotoPrintDraft, name: "Manisha" } });
    await decode();
    await press(view.button("Use this photo"));

    expect(paints.length).toBeGreaterThan(1);
    for (const paint of paints) {
      expect(paint.calls).toContain(`fillRect:0,0,${paint.width},${paint.height}`);
    }
    // …and the two canvases really are the two different sizes.
    expect(paints.map((paint) => paint.width)).toContain(PREVIEW_PX);
    expect(paints.map((paint) => paint.width)).toContain(OUTPUT_PX);
  });

  it("sends the shop the full-size frame, with the name already on it", async () => {
    const view = mount({
      file: photo(),
      draft: { ...emptyPhotoPrintDraft, name: "Manisha", zoom: 1.6 },
    });
    await decode();
    await press(view.button("Use this photo"));

    const printed = paints.find((paint) => paint.width === OUTPUT_PX);
    expect(printed?.calls).toContain(`fillRect:0,0,${OUTPUT_PX},${OUTPUT_PX}`);
    // …and no cut line: a guide printed on a cake is a mistake.
    expect(printed?.calls).not.toContain("stroke");
    expect(printed?.calls).toContain("fillText:Manisha");
    // The LIVE draft, not a default: zoom 1.6 of a 1200x900 photo in a 2400
    // frame is 5120x3840.
    expect(printed?.calls).toContain("drawImage:-2560.0,-1920.0,5120.0,3840.0");
  });

  it("cuts the file to the shape the shop chose, not always to a circle", async () => {
    /**
     * The first version printed every product round. A square topper cut round
     * loses its corners, and a heart cut round is not a heart — and only the
     * shop knows which of its products is which.
     */
    const view = mount({ file: photo(), shape: "heart" });
    await decode();
    await press(view.button("Use this photo"));

    const printed = paints.find((paint) => paint.width === OUTPUT_PX);
    expect(printed?.calls.filter((call) => call === "bezier").length).toBeGreaterThan(3);
    expect(printed?.calls).not.toContain("arc:1200,1200,1200");

    // …and the preview was cut to the same outline, at preview size.
    const shown = paints.find((paint) => paint.width === PREVIEW_PX);
    expect(shown?.calls.filter((call) => call === "bezier").length).toBeGreaterThan(3);
  });

  it("prints round for a product whose shop never chose", async () => {
    // Every photo product predates the picker, so the absent case is the
    // common one and has to keep doing what it always did.
    const view = mount({ file: photo() });
    await decode();
    await press(view.button("Use this photo"));

    const printed = paints.find((paint) => paint.width === OUTPUT_PX);
    expect(printed?.calls).toContain("arc:1200,1200,1200");
  });

  it("shows the cut line on screen and never in the file", async () => {
    /**
     * Everything outside the outline is white, and so is the page — so
     * without a hairline a round print and a square one look identical and
     * the customer cannot see which corners they are losing. Printed on a
     * cake, that same line is a mistake.
     */
    const view = mount({ file: photo() });
    await decode();
    await press(view.button("Use this photo"));

    const shown = paints.find((paint) => paint.width === PREVIEW_PX);
    const printed = paints.find((paint) => paint.width === OUTPUT_PX);
    expect(shown?.calls).toContain("stroke");
    expect(printed?.calls).not.toContain("stroke");
  });

  it("hands the flattened frame over as a file the upload will accept", async () => {
    const view = mount({ file: photo() });
    await decode();
    await press(view.button("Use this photo"));

    expect(view.onUse).toHaveBeenCalledTimes(1);
    const sent = view.onUse.mock.calls[0]?.[0] as File;
    expect(sent.type).toBe("image/jpeg");
    expect(sent.name).toBe("photo.jpg");
  });

  it("paints a canvas it has only just been handed", async () => {
    /**
     * A closed dialog is unmounted, so reopening builds a NEW canvas — and an
     * effect keyed only on the data does not run for it, because the data did
     * not change. “Change photo or name” opened onto a blank white circle over
     * a composition that was perfectly intact.
     */
    const view = mount({ file: photo() });
    await decode();
    expect(paints.length).toBeGreaterThan(0);

    view.rerender({ open: false });
    paints = [];
    view.rerender({ open: true });

    expect(paints.filter((paint) => paint.width === PREVIEW_PX).length).toBeGreaterThan(0);
  });

  it("uploads once however many times the button is pressed", async () => {
    /**
     * Painting and encoding 2400 square takes a moment, and the page's own
     * busy flag is a whole async hop away — so the button sat live and silent
     * for exactly the half-second in which somebody presses again. Two presses
     * meant two stored assets and two of a visitor's ten uploads an hour.
     */
    const view = mount({ file: photo() });
    await decode();

    const use = view.button("Use this photo");
    await act(async () => {
      use?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      use?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(view.onUse).toHaveBeenCalledTimes(1);
  });

  it("will not send a photograph the customer has already replaced", async () => {
    /**
     * The decoded bitmap is stored WITH the file it came from. Keeping only
     * the bitmap left the previous photograph on screen and enabled while the
     * new one decoded — and pressing then printed the one that was replaced.
     */
    const view = mount({ file: photo() });
    await decode();
    expect(view.button("Use this photo")?.hasAttribute("disabled")).toBe(false);

    view.rerender({ file: new File(["y"], "other.jpg", { type: "image/jpeg" }) });
    expect(view.button("Use this photo")?.hasAttribute("disabled")).toBe(true);
    expect(view.dialog()?.textContent).toContain("Opening your photo");
  });

  it("is enabled with a photograph and disabled while one is being sent", async () => {
    // Both halves, because the old version opened with no photograph at all —
    // so `!image` was doing the disabling and `busy` was never exercised.
    const view = mount({ file: photo() });
    await decode();
    expect(view.button("Use this photo")?.hasAttribute("disabled")).toBe(false);

    view.rerender({ busy: true });
    expect(view.button("Sending…")?.hasAttribute("disabled")).toBe(true);
    expect(view.button("Cancel")?.hasAttribute("disabled")).toBe(true);
  });

  it("gives its own sliders a coarse step that is not the whole range", () => {
    /**
     * Base UI's `largeStep` defaults to 10, and Zoom runs 1 to 3 — so left
     * alone Shift+Arrow and Page Up are indistinguishable from End. The
     * numbers live in PHOTO_RANGES and have to travel through `Adjust`; this
     * checks the whole path rather than the constant.
     */
    const view = mount({ draft: { ...emptyPhotoPrintDraft, zoom: 2 } });
    const zoom = [...(view.dialog()?.querySelectorAll("input[type='range']") ?? [])].find(
      (input) => input.getAttribute("aria-label") === "Zoom",
    );

    act(() => {
      zoom?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }),
      );
    });

    expect(view.onDraftChange).toHaveBeenCalledTimes(1);
    const next = view.onDraftChange.mock.calls[0]?.[0] as { zoom: number };
    expect(next.zoom).toBeCloseTo(2.1, 6);
  });

  it("refuses a file that is too large before it tries to open it", () => {
    const view = mount();
    const huge = new File(["x"], "raw.jpg", { type: "image/jpeg" });
    Object.defineProperty(huge, "size", { value: 40 * 1024 * 1024 });

    const picked = pick(view, huge);

    expect(view.onProblem).toHaveBeenCalledWith(expect.stringContaining("20 MB"));
    expect(view.onFileChange).not.toHaveBeenCalled();
    expect(decodes).toHaveLength(0);
    // …and the picker is still cleared, so choosing the same file again after
    // being told no still fires a change.
    expect(picked.cleared()).toBe(1);
  });

  it("starts a new photograph square on, and keeps the name", () => {
    /**
     * Zoom, pan and tilt describe the LAST picture. Carried over, a fresh
     * photograph drops in at somebody else's crop. The name is about the order
     * rather than the file, so it survives.
     */
    const view = mount({
      draft: { ...emptyPhotoPrintDraft, zoom: 2.4, rotation: 40, offsetX: -0.8, name: "Anaya" },
    });
    const picked = pick(view, photo());

    expect(view.onDraftChange).toHaveBeenCalledWith(
      expect.objectContaining({ zoom: 1, rotation: 0, offsetX: 0, name: "Anaya" }),
    );
    expect(view.onFileChange).toHaveBeenCalledTimes(1);
    expect(picked.cleared()).toBe(1);
  });

  it("puts the control back when a photograph will not open", async () => {
    const view = mount({ file: photo() });
    await act(async () => {
      decodes.splice(0).forEach((entry) => entry.fail());
    });

    expect(view.onProblem).toHaveBeenCalled();
    // Left set, the button read “Change photo” over an empty circle — the
    // picture of a photograph that loaded.
    expect(view.onFileChange).toHaveBeenCalledWith(null);
  });

  it("carries on when the browser will give it no canvas at all", () => {
    // Not hypothetical: a tab that has run out of contexts, and jsdom.
    HTMLCanvasElement.prototype.getContext = (() => null) as never;
    try {
      const view = mount({ file: photo() });
      expect(view.dialog()?.textContent).toContain("Fit your photo in the frame");
    } finally {
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
        const paint: Paint = { width: this.width, height: this.height, calls: [] };
        paints.push(paint);
        return recorder(paint.calls);
      } as never;
    }
  });
});

/**
 * The slider itself, written for this editor and used eight times in one dialog.
 *
 * Both of these are Base-UI-versus-Radix traps: the thumb is a div wrapping the
 * real input, so a habit carried over from Radix puts the name and the focus
 * ring on the wrong element and nothing looks wrong until somebody uses a
 * keyboard.
 */
describe("the slider these eight controls are built from", () => {
  const shown: Array<() => void> = [];
  afterEach(() => {
    while (shown.length) shown.pop()?.();
  });

  function draw(props: Record<string, unknown>) {
    const changes: number[] = [];
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        createElement(Slider, {
          "aria-label": "Zoom",
          value: 2,
          min: 1,
          max: 3,
          step: 0.01,
          largeStep: 0.1,
          onValueChange: (next: number) => changes.push(next),
          ...props,
        } as never),
      );
    });
    shown.push(() => {
      act(() => {
        root.unmount();
      });
      container.remove();
    });
    return {
      changes,
      root: container.querySelector<HTMLElement>("[data-slot='slider']"),
      input: container.querySelector<HTMLInputElement>("input[type='range']"),
      thumb: container.querySelector<HTMLElement>("[data-slot='slider'] [role='slider']"),
    };
  }

  it("names itself once, on the control that takes focus", () => {
    /**
     * Base UI gives the root `role="group"`, so a label left in the spread
     * names the group AND the input inside it — and a screen reader reads
     * “Zoom, group” then “Zoom, slider” for all eight of them in one dialog.
     */
    const view = draw({});
    expect(view.input?.getAttribute("aria-label")).toBe("Zoom");
    expect(view.root?.hasAttribute("aria-label")).toBe(false);
  });

  it("moves by its own large step, not by a tenth of a hundred", () => {
    /**
     * Base UI's `largeStep` defaults to 10. On a zoom that runs 1 to 3 that
     * makes Shift+Arrow and Page Up indistinguishable from End, so a keyboard
     * customer has two speeds: half a percent, or jump to the limit.
     */
    const view = draw({});
    act(() => {
      view.input?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true, bubbles: true }),
      );
    });

    expect(view.changes).toHaveLength(1);
    expect(view.changes[0]).toBeCloseTo(2.1, 6);
  });

  it("puts its focus ring where the focus actually lands", () => {
    /**
     * The thumb is a div; the thing that takes focus is the range input inside
     * it, and Base UI clips that input to nothing — so its own ring is
     * invisible and a `focus-visible:` class on the div never matches. Base
     * UI's own docs prescribe the `:has()` form for exactly this part.
     *
     * A class assertion, because jsdom resolves no `:focus-visible`. It is
     * still the whole of the defect: the wrong selector cannot match, ever.
     */
    const view = draw({});
    const thumb = view.input?.parentElement;
    expect(thumb?.className).toContain("has-[:focus-visible]:ring-3");
    expect(thumb?.className).not.toMatch(/(^|\s)focus-visible:ring-3/);
  });
});

/**
 * The outline a shop prints inside, which is not always a circle.
 *
 * The first version of this hard-coded a round frame, which is right for one
 * kind of cake and wrong for a square one, a heart one, and every photo frame,
 * mug and cushion a gift shop sells. A print area is GEOMETRY the canvas has to
 * clip to, so unlike a size or an option label a shop cannot type its own — it
 * picks, and the picker is on the product because one shop has several.
 */
describe("the outline a product is printed inside", () => {
  const ids = PHOTO_FRAME_SHAPES.map((shape) => shape.id);

  function trace(shape: (typeof PHOTO_FRAME_SHAPES)[number], width: number, height: number) {
    const calls: string[] = [];
    shape.outline(
      {
        arc: (x: number, y: number, r: number) => calls.push(`arc:${x},${y},${r}`),
        rect: (x: number, y: number, w: number, h: number) => calls.push(`rect:${x},${y},${w},${h}`),
        moveTo: (x: number, y: number) => calls.push(`moveTo:${x},${y}`),
        lineTo: (x: number, y: number) => calls.push(`lineTo:${x},${y}`),
        quadraticCurveTo: () => calls.push("quad"),
        bezierCurveTo: () => calls.push("bezier"),
        closePath: () => calls.push("closePath"),
      } as never,
      width,
      height,
    );
    return calls;
  }

  it("offers the three the shop asked for, and no more", () => {
    /**
     * Pinned rather than counted. A shape is not free: it is a picker option
     * a shop has to read, a value the validator has to admit, and an outline
     * the canvas has to draw — so a fourth is a decision, not a tidy-up.
     */
    expect(ids).toEqual(["circle", "square", "heart"]);
  });

  it("offers each outline once", () => {
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(1);
  });

  it("offers exactly what a product is allowed to be saved with", async () => {
    /**
     * The registry draws them and the validator admits them, and they are two
     * lists. A shape added to one and not the other is either a picker option
     * that 400s on save, or a stored value nothing knows how to draw.
     */
    const { productFormSchema } = await import("@/features/products/server/product.validators");
    const field = productFormSchema.shape.photoFrameShape;
    const allowed = (field as unknown as { unwrap: () => { options: string[] } }).unwrap().options;

    expect([...allowed].sort()).toEqual([...ids].sort());
  });

  it("prints round when the shop has never said otherwise", () => {
    // Every photo product predates this picker, so the absent case is the
    // common one and it has to keep doing what it always did.
    expect(frameShape(undefined).id).toBe("circle");
    expect(frameShape(null).id).toBe("circle");
    expect(frameShape("").id).toBe("circle");
  });

  it("prints round rather than throwing on a value it does not know", () => {
    // This reads whatever is in the database — an old export, a hand-edited
    // row. A product page that will not render is worse than a round print.
    expect(frameShape("oval").id).toBe("circle");
  });

  it("gives back the outline the shop actually chose", () => {
    for (const id of ids) expect(frameShape(id).id).toBe(id);
  });

  it("keeps the long side at the size it was asked for", () => {
    for (const shape of PHOTO_FRAME_SHAPES) {
      const size = frameSize(shape, 2400);
      expect(Math.max(size.width, size.height)).toBe(2400);
      expect(size.width / size.height).toBeCloseTo(shape.ratio, 2);
    }
  });

  it("gives every shipped shape a square box", () => {
    for (const shape of PHOTO_FRAME_SHAPES) {
      expect(frameSize(shape, 512), shape.id).toEqual({ width: 512, height: 512 });
    }
  });

  it("would stand an upright frame up, and lay a wide one down", () => {
    /**
     * No shipped shape is a rectangle yet. The machinery is measured anyway,
     * because a photo frame or a mug wrap is the obvious fourth and this is
     * the difference between adding a row to a list and redoing every
     * measurement in the file.
     */
    const upright = { ...frameShape("square"), ratio: 3 / 4 };
    const wide = { ...frameShape("square"), ratio: 4 / 3 };

    expect(frameSize(upright, 2400)).toEqual({ width: 1800, height: 2400 });
    expect(frameSize(wide, 2400)).toEqual({ width: 2400, height: 1800 });
  });

  it("actually traces something for every one of them", () => {
    // An outline that draws nothing clips to nothing, and the canvas comes out
    // blank white — which reads as a broken page rather than a missing shape.
    for (const shape of PHOTO_FRAME_SHAPES) {
      expect(trace(shape, 400, 400).length, shape.id).toBeGreaterThan(0);
    }
  });

  it("draws each outline as the thing it is called", () => {
    // A circle inscribed in its box…
    expect(trace(frameShape("circle"), 400, 400)).toContain("arc:200,200,200");
    // …a square that is the whole box…
    expect(trace(frameShape("square"), 400, 400)).toEqual(["rect:0,0,400,400"]);
    // …and a heart, which is a drawing rather than a formula: four curves at
    // the very least, starting from the notch at the top rather than a corner.
    const heart = trace(frameShape("heart"), 400, 400);
    expect(heart[0]).toMatch(/^moveTo:200,63[.]16/);
    expect(heart.filter((call) => call === "bezier").length).toBeGreaterThan(3);
    expect(heart).toContain("closePath");
    expect(heart).not.toContain("rect:0,0,400,400");
  });

  it("never reaches for roundRect, which older Safari does not have", () => {
    // A missing method throws inside the paint, on the one device most of
    // these customers are holding.
    for (const shape of PHOTO_FRAME_SHAPES) {
      expect(trace(shape, 400, 400).join(" ")).not.toContain("roundRect");
    }
  });
});

describe("a frame that is not square", () => {
  /**
   * Built as a BOX rather than looked up as a shape: none of the three a shop
   * can pick today is a rectangle. What is being measured is the geometry, and
   * the geometry is what a fourth shape would arrive needing.
   */
  const upright = { width: 1800, height: 2400 };

  it("still covers, in both directions", () => {
    // A photo that leaves white down the sides of an upright frame is not a
    // crop, it is a mistake nobody chose.
    for (const image of [SQUARE, LANDSCAPE, PORTRAIT]) {
      const placed = photoPlacement(image, upright, emptyPhotoPrintDraft);
      expect(placed.width).toBeGreaterThanOrEqual(upright.width - 0.001);
      expect(placed.height).toBeGreaterThanOrEqual(upright.height - 0.001);
    }
  });

  it("sizes the lettering off the short side", () => {
    /**
     * Off the long side, the same slider position would give lettering a third
     * taller the moment a shop switched a product from square to upright — and
     * a name set to fit a round topper would run off the edges of a tall one.
     */
    expect(namePlacement(upright, { ...emptyPhotoPrintDraft, nameSize: 0.1 }).fontSize).toBeCloseTo(
      180,
      6,
    );
  });

  it("keeps the preview and the print the same picture", () => {
    const small = { width: 384, height: 512 };
    const ratio = upright.width / small.width;
    const busy = { ...emptyPhotoPrintDraft, zoom: 1.4, offsetX: -0.3, offsetY: 0.2, name: "Anaya" };

    const near = photoPlacement(LANDSCAPE, small, busy);
    const far = photoPlacement(LANDSCAPE, upright, busy);
    expect(far.centreX).toBeCloseTo(near.centreX * ratio, 2);
    expect(far.centreY).toBeCloseTo(near.centreY * ratio, 2);
    expect(far.width).toBeCloseTo(near.width * ratio, 2);
    expect(namePlacement(upright, busy).fontSize).toBeCloseTo(
      namePlacement(small, busy).fontSize * ratio,
      2,
    );
  });
});

/**
 * The five gates a new product field has to clear, and the sixth nobody counts.
 *
 * `photoFrameShape` is stored on the PRODUCT because one shop has several: a
 * round topper, a heart topper and a rectangular frame can all be in the same
 * catalogue. Four of the five gates fail SILENTLY — Mongoose discards an
 * undeclared path while answering 201, and the storefront mapper is a
 * whitelist — so each is checked here rather than assumed.
 */
describe("the shape belongs to the product", () => {
  it("survives the write path the admin form posts through", async () => {
    const { productFormSchema } = await import("@/features/products/server/product.validators");
    const { createEmptyProductForm } = await import(
      "@/features/products/lib/products-repository"
    );

    const parsed = productFormSchema.safeParse({
      ...createEmptyProductForm(),
      name: "Photo frame",
      slug: "photo-frame",
      allowsPhotoUpload: true,
      photoFrameShape: "heart",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.photoFrameShape).toBe("heart");
  });

  it("is optional, so nothing written before today is refused", () => {
    /**
     * The three flags beside it are REQUIRED booleans, so every product
     * literal in the app and the suite already carries them. A required
     * seventh would 400 every import, seed and API client written before
     * today — for a field whose absence has a perfectly good meaning.
     */
    return import("@/features/products/server/product.validators").then(
      async ({ productFormSchema }) => {
        const { createEmptyProductForm } = await import(
          "@/features/products/lib/products-repository"
        );
        const bare = { ...createEmptyProductForm(), name: "Tee", slug: "tee" } as Record<
          string,
          unknown
        >;
        delete bare.photoFrameShape;

        expect(productFormSchema.safeParse(bare).success).toBe(true);
      },
    );
  });

  it("refuses an outline nothing knows how to draw", async () => {
    const { productFormSchema } = await import("@/features/products/server/product.validators");
    const { createEmptyProductForm } = await import(
      "@/features/products/lib/products-repository"
    );

    const parsed = productFormSchema.safeParse({
      ...createEmptyProductForm(),
      name: "Tee",
      slug: "tee",
      photoFrameShape: "oval",
    });

    expect(parsed.success).toBe(false);
  });

  it("is not dropped by Mongoose strict mode", async () => {
    /**
     * THE TRAP. `productSchema` runs with strict on, so a path it has not been
     * told about is discarded when the document is BUILT — no error, no
     * rejected write, and the API answers 201. Constructed rather than saved,
     * so no database is needed to prove it.
     */
    const { ProductModel } = await import("@/lib/server/db/models/product.model");
    const doc = new ProductModel({
      _id: "p-frame",
      name: "Photo frame",
      slug: "photo-frame",
      photoFrameShape: "heart",
    });

    const stored = doc.toObject() as { photoFrameShape?: string };
    expect(stored.photoFrameShape, "Mongoose strict mode dropped the field").toBe("heart");
  });

  it("crosses the storefront mapper, which is a whitelist and not a spread", async () => {
    // The other silent failure: a field missing from that list persists
    // perfectly and is never seen by a customer.
    const { mapAdminProductToStorefront } = await import(
      "@/features/products/lib/product-mapper"
    );

    const mapped = mapAdminProductToStorefront({
      id: "p-frame",
      name: "Photo frame",
      slug: "photo-frame",
      description: "",
      price: 499,
      images: ["/frame.jpg"],
      categoryId: "cat-gifts",
      occasionIds: [],
      weights: [],
      status: "published",
      shapes: [],
      flavourOptions: [],
      attributes: [],
      rating: 0,
      reviewCount: 0,
      allowsPhotoUpload: true,
      photoFrameShape: "square",
    } as never);

    expect(mapped.photoFrameShape).toBe("square");
  });

  it("is switched on under a name any trade can read", () => {
    /**
     * The switch was called “Photo Cake”. Flavour, egg, weight and shape name
     * bakery product fields and should — that is what tells a florist which to
     * turn off. A printed photograph is not one of those: a frame, a mug, a
     * cushion and a cake all take one, and a shop selling frames should not
     * have to switch on something named after a cake to offer it.
     *
     * The stored KEY stays `photoCake`; renaming that would rewrite every
     * settings document for a caption.
     */
    const page = readFileSync(join(process.cwd(), MODULES_PAGE), "utf8");

    expect(page).toContain('key: "photoCake"');
    expect(page).toContain('title: "Printed photo"');
    expect(page).not.toContain('title: "Photo Cake"');
  });

  it("is offered to the shop wherever it can be printed", () => {
    /**
     * The sixth gate: a field can clear all five and still be unreachable
     * because no control was ever drawn for it.
     */
    const form = readFileSync(join(process.cwd(), ADMIN_FORM), "utf8");
    expect(form).toContain("photoFrameShape");
    expect(form).toContain("PHOTO_FRAME_SHAPES");
    // …and only once the upload is on, because until then there is no print
    // to have a shape.
    expect(form).toContain("modules.photoCake && form.allowsPhotoUpload");
  });
});
