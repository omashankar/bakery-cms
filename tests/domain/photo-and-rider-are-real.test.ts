/**
 * Two things the storefront showed that nobody at the bakery had entered.
 *
 * The tracking page invented a courier for every order — a name, a phone number
 * a customer could ring, and a star rating for a delivery that had not happened
 * — chosen by hashing the order id against three hardcoded people. And the
 * photo-cake upload kept the file NAME in the browser and nothing else, so a
 * photo-cake order arrived with a surcharge on it and nothing to print.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

// Cloudinary is the one thing here that must not be real: a unit test should
// not upload to the shop's media host.
vi.mock("@/lib/server/media/cloudinary", () => ({
  isCloudinaryConfigured: () => true,
  uploadToCloudinary: vi.fn(async () => ({
    url: "https://cdn.example/photo.png",
    publicId: "p1",
    bytes: 1024,
  })),
}));

import { getDeliveryTrackingSnapshot } from "@/features/orders/lib/delivery-tracking";
import { uploadPhotoCakeImage } from "@/features/uploads/server/photo-upload.service";
import type { PlacedOrder } from "@/features/orders/lib/orders";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

function order(overrides: Partial<PlacedOrder> = {}): PlacedOrder {
  return {
    id: "ord-1",
    orderNumber: "BK-1",
    items: [],
    totals: { subtotal: 1, discount: 0, deliveryFee: 0, tax: 0, total: 1 },
    address: { fullName: "Asha", email: "a@b.c", city: "Mumbai", pincode: "400001" },
    paymentMethod: "cod",
    paymentStatus: "cod",
    placedAt: "2026-08-11T10:00:00.000Z",
    status: "out_for_delivery",
    statusHistory: [],
    estimatedDelivery: "2026-08-16T00:00:00.000Z",
    deliverySlot: { date: "2026-08-16", timeSlot: "2:00 PM – 4:00 PM" },
    ...overrides,
  } as unknown as PlacedOrder;
}

describe("the delivery partner on the tracking page", () => {
  it("is nobody until the bakery says who", () => {
    const snapshot = getDeliveryTrackingSnapshot(order());

    expect(snapshot.partner).toBeNull();
    expect(snapshot.showPartner).toBe(false);
  });

  it("does not name an invented courier in the status line", () => {
    // It read "Ravi Kumar is on the way with your cakes" on every order, about
    // a person the shop has never employed.
    expect(getDeliveryTrackingSnapshot(order()).etaDetail).not.toMatch(/is on the way with/);
  });

  it("is the person the bakery entered, once they have", () => {
    const snapshot = getDeliveryTrackingSnapshot(
      order({ deliveryPartner: { name: "Imran", phone: "9812345678", vehicle: "Bike" } }),
    );

    expect(snapshot.showPartner).toBe(true);
    expect(snapshot.partner).toEqual({ name: "Imran", phone: "9812345678", vehicle: "Bike" });
    expect(snapshot.etaDetail).toContain("Imran");
  });

  it("is the same person for the same order every time", () => {
    // The old one was chosen by hashing the order id, so it was at least
    // stable — but stable and invented. This is stable because it is stored.
    const placed = order({ deliveryPartner: { name: "Imran" } });

    expect(getDeliveryTrackingSnapshot(placed).partner).toEqual(
      getDeliveryTrackingSnapshot(placed).partner,
    );
  });

  it("carries no rating and no partner id to invent", () => {
    const snapshot = getDeliveryTrackingSnapshot(order({ deliveryPartner: { name: "Imran" } }));

    expect(snapshot.partner).not.toHaveProperty("rating");
    expect(snapshot.partner).not.toHaveProperty("partnerId");
  });

  it("has no hardcoded people left in the module", () => {
    const source = read("features/orders/lib/delivery-tracking.ts");
    // The comment explaining what was removed names one of them, so this looks
    // at the code rather than the prose.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

    expect(code).not.toContain("DELIVERY_PARTNERS");
    expect(code).not.toContain("98765 43210");
    expect(code).not.toContain("pickPartner");
  });

  it("shows nobody on a cancelled order either", () => {
    expect(getDeliveryTrackingSnapshot(order({ status: "cancelled" })).showPartner).toBe(false);
  });
});

describe("the customer photo upload", () => {
  const service = read("features/uploads/server/photo-upload.service.ts");
  const controller = read("features/uploads/server/photo-upload.controller.ts");

  it("is not open to the public", () => {
    // The only upload a member of the public can reach. Anonymous, it would be
    // a place to park arbitrary files on the shop's media host at its expense.
    expect(controller).toContain("requireCustomer()");
    expect(controller).toContain("rateLimit(");
  });

  it("caps the size against the bytes it received, not the reported size", () => {
    expect(service).toContain("buffer.byteLength > MAX_BYTES");
  });

  it("never consults the type the browser reported", () => {
    // `file.type` is chosen by the client.
    expect(service).not.toContain("file.type");
  });

  it("refuses rather than storing a 6MB data URI on the order", () => {
    // The media library's fallback keeps the raw data URI in the database. On
    // an order document that is an 8MB string sent to every admin screen that
    // lists orders.
    expect(service).toContain("isCloudinaryConfigured()");
    expect(service).toContain("503");
  });

  it("keeps customer photos out of the shop's Media library", () => {
    // One customer's private photograph attached to one order, not stock the
    // admin browses and reuses.
    expect(service).toContain('"bakery-cms/photo-cakes"');
  });
});

/**
 * The type check, exercised rather than read.
 *
 * An earlier version of these asserted that the source mentioned `sniff` and
 * `SIGNATURES` — which stayed true when the call was replaced with a hardcoded
 * `"image/png"`, so the test passed while every file in the world was accepted
 * as a PNG.
 */
describe("what the upload accepts", () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0]);
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

  /** Announced as a PNG whatever it really is — the client picks this field. */
  const asPhoto = (bytes: Uint8Array) =>
    new File([bytes as unknown as BlobPart], "photo.png", { type: "image/png" });

  it("takes a real PNG", async () => {
    await expect(uploadPhotoCakeImage(asPhoto(PNG))).resolves.toMatchObject({
      url: "https://cdn.example/photo.png",
    });
  });

  it("takes a real JPEG", async () => {
    await expect(uploadPhotoCakeImage(asPhoto(JPEG))).resolves.toBeTruthy();
  });

  it("refuses an SVG dressed as a PNG", async () => {
    // The dangerous one: an SVG carries script, and it would be stored and
    // later served from the shop's own media host.
    await expect(uploadPhotoCakeImage(asPhoto(SVG))).rejects.toThrow(/JPEG, PNG or WebP/);
  });

  it("refuses an empty file", async () => {
    await expect(uploadPhotoCakeImage(asPhoto(new Uint8Array()))).rejects.toThrow(/empty/i);
  });

  it("refuses something far too big before it reaches the uploader", async () => {
    const huge = new Uint8Array(7 * 1024 * 1024);
    huge.set(PNG.subarray(0, 8));

    await expect(uploadPhotoCakeImage(asPhoto(huge))).rejects.toThrow(/too large/i);
  });
});

describe("the photo reaching the bakery", () => {
  it("survives every hop from the cart line to the stored order", () => {
    // A field that stops at any one of these is a photo the baker never sees.
    const hops: [string, string][] = [
      ["features/cart/lib/cart.ts", "photoUrl: input.photoUrl"],
      ["features/checkout/lib/quote-api.ts", "photoUrl: item.photoUrl"],
      ["features/checkout/server/checkout.validators.ts", "photoUrl:"],
      ["features/checkout/server/pricing.server.ts", "photoUrl?: string"],
      ["features/orders/server/order.service.ts", "photoUrl: typeof line.photoUrl"],
    ];

    for (const [path, needle] of hops) {
      expect(read(path), `${path} drops the photo`).toContain(needle);
    }
  });

  it("is put in front of the person who has to print it", () => {
    expect(read("apps/admin/commerce/pages/order-detail-page.tsx")).toContain("item.photoUrl");
  });
});

describe("assigning a rider", () => {
  it("clears the assignment on a blank name", async () => {
    // An admin who set the wrong person must be able to take it back off the
    // customer's tracking page, and there is no other control that would.
    const { deliveryPartnerSchema } = await import(
      "@/features/orders/server/order.validators"
    );

    expect(deliveryPartnerSchema.safeParse({ name: "" }).success).toBe(true);
    expect(deliveryPartnerSchema.safeParse({ name: "Imran", phone: "98123" }).success).toBe(true);
  });

  it("is an admin-only write", () => {
    const controller = read("features/orders/server/order.controller.ts");
    const fn = controller.slice(controller.indexOf("export const deliveryPartnerController"));

    expect(fn.slice(0, fn.indexOf("});"))).toContain("requireRole(...ORDER_ROLES)");
  });
});
