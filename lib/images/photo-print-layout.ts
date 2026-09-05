/**
 * Where a customer's photograph and their name sit inside the frame that gets
 * printed.
 *
 * All of it is arithmetic on fractions of the frame, and none of it touches a
 * DOM node — which is the point. The preview's long side is 512 pixels and the
 * file the shop receives is 2400, and the ONE thing a customer cannot forgive
 * is those two disagreeing: they nudged a face into the middle of the frame,
 * pressed the button, and the shop printed something else.
 *
 * So there is one `paintPhotoFrame`, called twice at different sizes, and every
 * number it uses is derived from the frame it was handed. WYSIWYG here is
 * structural rather than a coincidence that holds until somebody edits one of
 * two copies.
 */

import type { PhotoFrameShapeId } from "@/types/product";

export type { PhotoFrameShapeId };

/** The printed file's LONG side, in pixels. */
export const OUTPUT_PX = 2400;

/**
 * How big the preview's backing store is; the box it draws into is smaller.
 *
 * The frame is capped at 24rem of CSS, so this is drawn DOWN rather than up —
 * the right way round for judging a crop, though it does mean the preview is
 * softer than the print on a dense screen rather than sharper.
 */
export const PREVIEW_PX = 512;

/**
 * How many characters fit on a printed frame.
 *
 * Not a shop preference yet — a longer name simply shrinks to nothing against
 * the photograph, so this is closer to a physical fact than a policy.
 */
export const NAME_LIMIT = 25;

/**
 * What the browser will be asked to DECODE, which is not what gets uploaded.
 *
 * The server caps an upload at 6 MB, and it still does — but what now reaches
 * it is this module's JPEG, which lands a megabyte or two whatever was fed in.
 * So the customer's own file only has to be small enough to open without
 * stalling a phone.
 */
export const MAX_CHOSEN_BYTES = 20 * 1024 * 1024;

/** Mirrors the magic-byte list the upload service will sniff for. */
const DECODABLE = ["image/jpeg", "image/png", "image/webp"];

export interface PhotoPrintDraft {
  /** 1 fills the frame exactly; above that, closer in. */
  zoom: number;
  /** −1 … 1, as a fraction of half the frame. */
  offsetX: number;
  offsetY: number;
  /** Degrees. */
  rotation: number;
  name: string;
  /** Height of the lettering, as a fraction of the frame's short side. */
  nameSize: number;
  nameX: number;
  nameY: number;
  nameRotation: number;
  bold: boolean;
  italic: boolean;
  colour: string;
}

/**
 * The starting point, and why it is not all zeroes.
 *
 * `zoom: 1` is the photo filling the frame — the only sensible first thing to
 * see. The lettering starts in the LOWER third rather than dead centre, which
 * is where a caption goes and, more to the point, is not across the face
 * somebody just chose.
 */
export const emptyPhotoPrintDraft: PhotoPrintDraft = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0,
  rotation: 0,
  name: "",
  nameSize: 0.11,
  nameX: 0,
  nameY: 0.35,
  nameRotation: 0,
  bold: true,
  italic: false,
  colour: "#8b4513",
};

/**
 * The one place the sliders' ends are written down.
 *
 * `largeStep` is here because Base UI's default is 10 — which on a zoom that
 * runs 1 to 3 makes Shift+Arrow and Page Up indistinguishable from End. Left
 * alone, a keyboard customer has exactly two speeds: half a percent of the
 * range per press, or jump to the limit.
 */
export const PHOTO_RANGES = {
  zoom: { min: 1, max: 3, step: 0.01, largeStep: 0.1 },
  offset: { min: -1, max: 1, step: 0.01, largeStep: 0.1 },
  rotation: { min: -180, max: 180, step: 1, largeStep: 15 },
  nameSize: { min: 0.04, max: 0.2, step: 0.005, largeStep: 0.02 },
} as const;

/* ─────────────────────────── the shape of the print ─────────────────────── */


/**
 * The subset of a 2D context this module uses.
 *
 * Named rather than taking `CanvasRenderingContext2D` so the drawing itself can
 * be tested: jsdom has no canvas, and a recording stub proves the order of
 * operations — ground, then clip, then photo, then lettering — which is the
 * part that actually goes wrong.
 */
export interface FramePainter {
  save(): void;
  restore(): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  bezierCurveTo(
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
    x: number,
    y: number,
  ): void;
  arc(x: number, y: number, radius: number, start: number, end: number): void;
  rect(x: number, y: number, width: number, height: number): void;
  clip(): void;
  stroke(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  fillRect(x: number, y: number, width: number, height: number): void;
  drawImage(image: never, dx: number, dy: number, dw: number, dh: number): void;
  fillText(text: string, x: number, y: number): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
}

export interface PhotoFrameShape {
  id: PhotoFrameShapeId;
  /** What the shop sees in the picker. Any trade may print any of these. */
  label: string;
  /** Width ÷ height. The print's proportions, not a preference. */
  ratio: number;
  /** Trace the printable outline into the current path. */
  outline: (painter: FramePainter, width: number, height: number) => void;
}

/**
 * A heart, as fractions of its box.
 *
 * Six segments of the classic canvas heart, normalised out of the 110×95 box it
 * is usually written in so it fills whatever it is handed. Magic numbers, and
 * unavoidably so — a heart is a drawing, not a formula.
 */
const HEART: [number, number, number, number, number, number][] = [
  [0.5, 0.126, 0.4545, 0, 0.2727, 0],
  [0, 0, 0, 0.3947, 0, 0.3947],
  [0, 0.5789, 0.1818, 0.8105, 0.5, 1],
  [0.8182, 0.8105, 1, 0.5789, 1, 0.3947],
  [1, 0.3947, 1, 0, 0.7273, 0],
  [0.5909, 0, 0.5, 0.126, 0.5, 0.1579],
];

/**
 * Every shape a print can be, and the only ones.
 *
 * A frame is GEOMETRY the canvas has to clip to, so unlike a size or an option
 * label the shop cannot invent one — it picks, per product, in the admin.
 * Three: the toppers these shops actually cut.
 *
 * All three are square boxes today. The width-and-height machinery below is
 * still there because a rectangle — a photo frame, a mug wrap — is the obvious
 * fourth, and it is the one addition that would otherwise mean redoing every
 * measurement in this file rather than adding a row to this list.
 */
export const PHOTO_FRAME_SHAPES: PhotoFrameShape[] = [
  {
    id: "circle",
    label: "Round",
    ratio: 1,
    outline: (painter, width, height) => {
      painter.arc(width / 2, height / 2, Math.min(width, height) / 2, 0, Math.PI * 2);
    },
  },
  {
    id: "square",
    label: "Square",
    ratio: 1,
    outline: (painter, width, height) => painter.rect(0, 0, width, height),
  },
  {
    id: "heart",
    label: "Heart",
    ratio: 1,
    outline: (painter, width, height) => {
      painter.moveTo(width / 2, height * 0.1579);
      for (const [ax, ay, bx, by, x, y] of HEART) {
        painter.bezierCurveTo(
          ax * width,
          ay * height,
          bx * width,
          by * height,
          x * width,
          y * height,
        );
      }
      painter.closePath();
    },
  },
];

/**
 * The shape a product prints in, whatever is stored against it.
 *
 * Falls back to round rather than throwing: this reads a value that came out of
 * a database, and a product page that will not render is worse than one that
 * renders the shape every photo product used before there was a choice.
 */
export function frameShape(id: string | undefined | null): PhotoFrameShape {
  return PHOTO_FRAME_SHAPES.find((shape) => shape.id === id) ?? PHOTO_FRAME_SHAPES[0]!;
}

export interface FrameBox {
  width: number;
  height: number;
}

/**
 * Fit a shape's proportions into a box whose LONG side is `longSide`.
 *
 * Long side rather than width, so an upright rectangle and a wide one produce
 * files of the same weight and the same detail — a portrait frame scaled off
 * its width would be a third smaller for no reason a customer could see.
 */
export function frameSize(shape: PhotoFrameShape, longSide: number): FrameBox {
  return shape.ratio >= 1
    ? { width: longSide, height: Math.round(longSide / shape.ratio) }
    : { width: Math.round(longSide * shape.ratio), height: longSide };
}

/* ───────────────────────────── what goes where ──────────────────────────── */

/** How many more characters the frame will take. Never negative. */
export function charactersLeft(name: string): number {
  return Math.max(0, NAME_LIMIT - name.length);
}

/**
 * Why this file cannot be used, in words a customer can act on, or null.
 *
 * A mirror of the server's refusals rather than a replacement for them: this
 * runs before anything is decoded so nobody watches a spinner to be told no,
 * and the server still checks the actual bytes because a browser reports a
 * type the page chose.
 */
export function photoFileProblem(file: { size: number; type: string }): string | null {
  if (file.size === 0) return "That file is empty.";
  if (file.size > MAX_CHOSEN_BYTES) {
    return `That photo is too large. Please use an image under ${MAX_CHOSEN_BYTES / (1024 * 1024)} MB.`;
  }
  /**
   * An EMPTY type is allowed through.
   *
   * Some phones and file managers hand over a File with no type at all, and
   * refusing those would turn a working photograph into "wrong format" for a
   * reason the customer cannot see or fix. It fails at decode instead, which
   * is honest, and the server sniffs the bytes either way.
   */
  if (file.type && !DECODABLE.includes(file.type)) {
    return "Please choose a JPEG, PNG or WebP image.";
  }
  return null;
}

export interface PhotoPlacement {
  /** Where the middle of the photo lands, in frame units. */
  centreX: number;
  centreY: number;
  width: number;
  height: number;
  radians: number;
}

/**
 * Fit the photograph to the frame, then apply what the customer asked for.
 *
 * COVER, not contain: at zoom 1 the photograph spans the frame in both
 * directions and overhangs in one. Containing it would letterbox a portrait
 * photograph inside a circle, which is not a thing anybody wants printed — and
 * it would make the zoom slider the only way to reach a normal result.
 */
export function photoPlacement(
  image: { width: number; height: number },
  frame: FrameBox,
  draft: PhotoPrintDraft,
): PhotoPlacement {
  const fits =
    image.width > 0 && image.height > 0
      ? Math.max(frame.width / image.width, frame.height / image.height)
      : 0;
  const scale = fits * draft.zoom;

  return {
    centreX: frame.width / 2 + draft.offsetX * frame.width * 0.5,
    centreY: frame.height / 2 + draft.offsetY * frame.height * 0.5,
    width: image.width * scale,
    height: image.height * scale,
    radians: (draft.rotation * Math.PI) / 180,
  };
}

export interface NamePlacement {
  x: number;
  y: number;
  radians: number;
  fontSize: number;
  font: string;
}

/**
 * Where the lettering goes, and what it is set in.
 *
 * Sized against the SHORT side, so the same slider position does not produce
 * lettering half again as tall the moment a shop switches a product to a wide
 * frame.
 *
 * The family is a serif stack rather than a webfont on purpose: a canvas draws
 * with whatever the browser has THIS INSTANT, so a font still loading paints
 * the fallback into the file and nobody finds out until it is printed.
 */
export function namePlacement(frame: FrameBox, draft: PhotoPrintDraft): NamePlacement {
  const fontSize = draft.nameSize * Math.min(frame.width, frame.height);
  const weight = draft.bold ? "700" : "400";
  const slant = draft.italic ? "italic " : "";

  return {
    x: frame.width / 2 + draft.nameX * frame.width * 0.5,
    y: frame.height / 2 + draft.nameY * frame.height * 0.5,
    radians: (draft.nameRotation * Math.PI) / 180,
    fontSize,
    font: `${slant}${weight} ${fontSize}px Georgia, "Times New Roman", serif`,
  };
}

/**
 * WHITE, and not transparent.
 *
 * The file is a JPEG, which has no transparency to offer — and the area outside
 * the outline is not "nothing", it is the part of the sheet that does not get
 * printed. White is what that is.
 */
const GROUND = "#ffffff";

/** The cut line, drawn on the preview only. */
const GUIDE = "rgba(0,0,0,0.28)";

export interface PaintedFrame extends FrameBox {
  shape: PhotoFrameShape;
  /**
   * Draw the outline as a hairline afterwards. PREVIEW ONLY.
   *
   * Everything outside the shape is white, and so is everything around the
   * canvas — so without this a round print and a square one look identical on
   * screen and the customer cannot see which corners they are losing. It must
   * never reach the file: a cut line printed on a cake is a mistake.
   */
  guide?: boolean;
}

/**
 * Paint one frame: ground, photograph, lettering.
 *
 * Every measurement comes from the frame handed in, so the same call fills the
 * 512px preview and the 2400px file with the same picture. Nothing outside the
 * outline is drawn, because nothing outside the outline is printed.
 */
export function paintPhotoFrame(
  painter: FramePainter,
  frame: PaintedFrame,
  image: { width: number; height: number } | null,
  draft: PhotoPrintDraft,
): void {
  const { width, height, shape } = frame;

  painter.save();
  painter.fillStyle = GROUND;
  painter.fillRect(0, 0, width, height);

  painter.beginPath();
  shape.outline(painter, width, height);
  painter.clip();

  if (image && image.width > 0 && image.height > 0) {
    const placed = photoPlacement(image, frame, draft);
    painter.save();
    painter.translate(placed.centreX, placed.centreY);
    painter.rotate(placed.radians);
    painter.drawImage(
      image as never,
      -placed.width / 2,
      -placed.height / 2,
      placed.width,
      placed.height,
    );
    painter.restore();
  }

  const name = draft.name.trim();
  if (name) {
    const placed = namePlacement(frame, draft);
    painter.save();
    painter.translate(placed.x, placed.y);
    painter.rotate(placed.radians);
    painter.font = placed.font;
    painter.fillStyle = draft.colour;
    painter.textAlign = "center";
    painter.textBaseline = "middle";
    painter.fillText(name, 0, 0);
    painter.restore();
  }

  painter.restore();

  if (frame.guide) {
    painter.save();
    painter.beginPath();
    shape.outline(painter, width, height);
    painter.strokeStyle = GUIDE;
    painter.lineWidth = Math.max(1, Math.min(width, height) / 256);
    painter.stroke();
    painter.restore();
  }
}
