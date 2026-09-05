import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PhotoPrintEditor } from "@/components/storefront/photo-print-editor";
import { Slider } from "@/components/ui/slider";
import {
  charactersLeft,
  emptyPhotoPrintDraft,
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
      const placed = photoPlacement(image, frame, emptyPhotoPrintDraft);
      expect(Math.min(placed.width, placed.height)).toBeCloseTo(frame, 6);
      expect(Math.max(placed.width, placed.height)).toBeGreaterThanOrEqual(frame);
    }
  });

  it("keeps the photograph's own proportions", () => {
    // A face squashed to fit is worse than a face cropped to fit.
    const placed = photoPlacement(LANDSCAPE, 400, emptyPhotoPrintDraft);
    expect(placed.width / placed.height).toBeCloseTo(2, 6);
  });

  it("zooms from the fitted size, not from the pixel size", () => {
    const one = photoPlacement(PORTRAIT, 400, emptyPhotoPrintDraft);
    const two = photoPlacement(PORTRAIT, 400, { ...emptyPhotoPrintDraft, zoom: 2 });
    expect(two.width).toBeCloseTo(one.width * 2, 6);
    expect(two.height).toBeCloseTo(one.height * 2, 6);
  });

  it("moves the photograph by half the frame at each end of the slider", () => {
    const frame = 400;
    const right = photoPlacement(SQUARE, frame, { ...emptyPhotoPrintDraft, offsetX: 1 });
    const down = photoPlacement(SQUARE, frame, { ...emptyPhotoPrintDraft, offsetY: -1 });

    expect(right.centreX).toBeCloseTo(frame / 2 + frame / 2, 6);
    expect(right.centreY).toBeCloseTo(frame / 2, 6);
    expect(down.centreY).toBeCloseTo(0, 6);
  });

  it("turns degrees into radians the way a canvas wants them", () => {
    expect(
      photoPlacement(SQUARE, 400, { ...emptyPhotoPrintDraft, rotation: 90 }).radians,
    ).toBeCloseTo(Math.PI / 2, 9);
  });

  it("answers zero rather than NaN for an image with no size", () => {
    // Reachable: a file that decodes to nothing, and a stub in a test. NaN would
    // reach `drawImage` and silently paint an empty frame with no error.
    const placed = photoPlacement({ width: 0, height: 0 }, 400, emptyPhotoPrintDraft);
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
    const small = photoPlacement(PORTRAIT, 512, busy);
    const large = photoPlacement(PORTRAIT, OUTPUT_PX, busy);

    expect(large.centreX).toBeCloseTo(small.centreX * ratio, 6);
    expect(large.centreY).toBeCloseTo(small.centreY * ratio, 6);
    expect(large.width).toBeCloseTo(small.width * ratio, 6);
    expect(large.height).toBeCloseTo(small.height * ratio, 6);
    expect(large.radians).toBeCloseTo(small.radians, 9);
  });

  it("places the lettering at the same fraction of either frame", () => {
    const small = namePlacement(512, busy);
    const large = namePlacement(OUTPUT_PX, busy);

    expect(large.x).toBeCloseTo(small.x * ratio, 6);
    expect(large.y).toBeCloseTo(small.y * ratio, 6);
    expect(large.fontSize).toBeCloseTo(small.fontSize * ratio, 6);
    expect(large.radians).toBeCloseTo(small.radians, 9);
  });
});

describe("how the name is set", () => {
  it("sizes the lettering against the frame, not in fixed points", () => {
    // 14pt is a caption on the preview and a speck on the printed sheet.
    expect(namePlacement(400, { ...emptyPhotoPrintDraft, nameSize: 0.1 }).fontSize).toBeCloseTo(40);
  });

  it("says bold and italic in the one string a canvas understands", () => {
    const plain = namePlacement(400, { ...emptyPhotoPrintDraft, bold: false, italic: false }).font;
    const both = namePlacement(400, { ...emptyPhotoPrintDraft, bold: true, italic: true }).font;

    expect(plain).toContain("400 ");
    expect(plain).not.toContain("italic");
    expect(both).toContain("italic");
    expect(both).toContain("700 ");
  });

  it("moves the lettering by half the frame at each end of the slider", () => {
    // The same units as the photo sliders, so the two halves of this editor
    // do not need learning separately.
    const frame = 400;
    expect(namePlacement(frame, { ...emptyPhotoPrintDraft, nameX: 1, nameY: 0 }).x).toBeCloseTo(
      400,
      6,
    );
    expect(namePlacement(frame, { ...emptyPhotoPrintDraft, nameX: 0, nameY: -1 }).y).toBeCloseTo(
      0,
      6,
    );
    expect(namePlacement(frame, { ...emptyPhotoPrintDraft, nameX: 0, nameY: 0 }).x).toBeCloseTo(
      200,
      6,
    );
  });

  it("tilts the lettering by the degrees the slider says", () => {
    expect(
      namePlacement(400, { ...emptyPhotoPrintDraft, nameRotation: -90 }).radians,
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
    const families = namePlacement(400, emptyPhotoPrintDraft)
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
      clip: () => calls.push("clip"),
      translate: (x: number, y: number) => calls.push(`translate:${x},${y}`),
      rotate: (a: number) => calls.push(`rotate:${a.toFixed(4)}`),
      fillRect: (x: number, y: number, w: number, h: number) =>
        calls.push(`fillRect:${x},${y},${w},${h}`),
      drawImage: (_i: never, dx: number, dy: number, dw: number, dh: number) =>
        calls.push(`drawImage:${dx.toFixed(1)},${dy.toFixed(1)},${dw.toFixed(1)},${dh.toFixed(1)}`),
      fillText: (text: string) => calls.push(`fillText:${text}`),
      fillStyle: "",
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
    paintPhotoFrame(painter, 400, SQUARE, emptyPhotoPrintDraft);

    expect(calls).toContain("fillRect:0,0,400,400");
    expect(at(calls, "fillRect")).toBeLessThan(at(calls, "clip"));
    expect(state.fillStyle).not.toBe("");
  });

  it("clips to the circle the frame contains", () => {
    const { painter, calls } = recorder();
    paintPhotoFrame(painter, 400, SQUARE, emptyPhotoPrintDraft);

    expect(calls).toContain("arc:200,200,200");
    expect(at(calls, "arc")).toBeLessThan(at(calls, "clip"));
    // …and everything painted after it is inside that clip.
    expect(at(calls, "clip")).toBeLessThan(at(calls, "drawImage"));
  });

  it("draws the photograph centred on its own middle", () => {
    const { painter, calls } = recorder();
    paintPhotoFrame(painter, 400, LANDSCAPE, emptyPhotoPrintDraft);

    expect(calls).toContain("translate:200,200");
    // 2000x1000 covering a 400 frame is 800x400, drawn from -400,-200.
    expect(calls).toContain("drawImage:-400.0,-200.0,800.0,400.0");
  });

  it("still paints a frame when no photograph has been chosen", () => {
    // The dialog opens before anything is picked, and an unpainted canvas is a
    // grey rectangle that reads as broken.
    const { painter, calls } = recorder();
    paintPhotoFrame(painter, 400, null, emptyPhotoPrintDraft);

    expect(calls).toContain("fillRect:0,0,400,400");
    expect(at(calls, "drawImage")).toBe(-1);
  });

  it("puts the lettering over the photograph, not under it", () => {
    const { painter, calls } = recorder();
    paintPhotoFrame(painter, 400, SQUARE, { ...emptyPhotoPrintDraft, name: "Manisha" });

    expect(calls).toContain("fillText:Manisha");
    expect(at(calls, "drawImage")).toBeLessThan(at(calls, "fillText"));
  });

  it("writes nothing at all when no name was typed", () => {
    const { painter, calls } = recorder();
    paintPhotoFrame(painter, 400, SQUARE, { ...emptyPhotoPrintDraft, name: "   " });

    expect(at(calls, "fillText")).toBe(-1);
  });

  it("uses the colour the customer picked", () => {
    const { painter, state } = recorder();
    paintPhotoFrame(painter, 400, SQUARE, {
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
      clip: () => calls.push("clip"),
      translate: (x: number, y: number) => calls.push(`translate:${x},${y}`),
      rotate: (a: number) => calls.push(`rotate:${a.toFixed(4)}`),
      fillRect: (x: number, y: number, w: number, h: number) =>
        calls.push(`fillRect:${x},${y},${w},${h}`),
      drawImage: (_i: unknown, dx: number, dy: number, dw: number, dh: number) =>
        calls.push(`drawImage:${dx.toFixed(1)},${dy.toFixed(1)},${dw.toFixed(1)},${dh.toFixed(1)}`),
      fillText: (text: string) => calls.push(`fillText:${text}`),
      fillStyle: "",
      font: "",
      textAlign: "start",
      textBaseline: "alphabetic",
    };
  }

  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement) {
      const paint: Paint = { width: this.width, calls: [] };
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
      expect(paint.calls).toContain(`fillRect:0,0,${paint.width},${paint.width}`);
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
    expect(printed?.calls).toContain("fillText:Manisha");
    // The LIVE draft, not a default: zoom 1.6 of a 1200x900 photo in a 2400
    // frame is 5120x3840.
    expect(printed?.calls).toContain("drawImage:-2560.0,-1920.0,5120.0,3840.0");
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
        const paint: Paint = { width: this.width, calls: [] };
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
