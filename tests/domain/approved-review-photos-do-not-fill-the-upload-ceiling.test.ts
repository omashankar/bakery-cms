import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * APPROVED REVIEW PHOTOS DO NOT FILL THE UPLOAD CEILING.
 *
 * The open photo upload refuses once 2,000 photos sit unclaimed. It counted
 * EVERY row — and a photo on a review keeps its row for as long as the review
 * shows it, so 500 real reviews with four photos each reached the ceiling by
 * themselves. From then on every photo cake and every review photo was refused,
 * with no way back: the sweep that frees rows only ran after a SUCCESSFUL
 * upload. And the server read a whole request body before asking its size.
 */
const db = vi.hoisted(() => ({
  rows: [] as { _id: string; publicId: string; url: string; keptFor?: string; stale: boolean }[],
  reviews: [] as { photoUrls: string[]; status: string }[],
  deletedFromCloudinary: [] as string[],
}));

vi.mock("@/lib/server/db/mongoose", () => ({ connectDB: vi.fn(async () => undefined) }));
vi.mock("@/lib/server/media/cloudinary", () => ({
  isCloudinaryConfigured: () => true,
  uploadToCloudinary: vi.fn(),
  deleteFromCloudinary: vi.fn(async (publicId: string) => void db.deletedFromCloudinary.push(publicId)),
}));
vi.mock("@/lib/server/db/models/photo-upload.model", () => ({
  PhotoUploadModel: {
    countDocuments: vi.fn(async (filter: { keptFor?: { $exists?: boolean } }) =>
      filter?.keptFor?.$exists === false ? db.rows.filter((r) => !r.keptFor).length : db.rows.length,
    ),
    estimatedDocumentCount: vi.fn(async () => db.rows.length),
    find: () => ({
      limit: (n: number) => ({ lean: async () => db.rows.filter((r) => r.stale).slice(0, n) }),
    }),
    deleteOne: vi.fn(async (filter: { _id: string }) => {
      db.rows = db.rows.filter((r) => r._id !== filter._id);
    }),
    updateOne: vi.fn(async (filter: { _id: string }, update: { $set?: { keptFor?: string }; $unset?: object }) => {
      const row = db.rows.find((r) => r._id === filter._id);
      if (!row) return;
      row.stale = false;
      if (update.$set?.keptFor) row.keptFor = update.$set.keptFor;
      if (update.$unset) delete row.keptFor;
    }),
  },
}));
const none = vi.hoisted(() => ({ find: () => ({ select: () => ({ lean: async () => [] as unknown[] }) }) }));
vi.mock("@/lib/server/db/models/order.model", () => ({ OrderModel: none }));
vi.mock("@/lib/server/db/models/checkout-draft.model", () => ({ CheckoutDraftModel: none }));
vi.mock("@/lib/server/db/models/review.model", () => ({
  ReviewModel: {
    find: (query: { photoUrls?: { $in?: string[] } }) => ({
      select: (fields: string) => ({
        lean: async () => {
          if (!fields.includes("status")) throw new Error("the sweep must read the review's status");
          const wanted = query.photoUrls?.$in ?? [];
          return db.reviews
            .filter((r) => r.photoUrls.some((u) => wanted.includes(u)))
            .map((r) => ({ photoUrls: r.photoUrls, status: r.status }));
        },
      }),
    }),
  },
}));

import { refuseIfStorageIsFull, refuseOversizedBody } from "@/features/uploads/server/photo-upload.service";

const row = (i: number, extra: Partial<(typeof db.rows)[number]> = {}) => ({
  _id: `r${i}`,
  publicId: `p${i}`,
  url: `https://res.cloudinary.com/x/image/upload/bakery-cms/photo-cakes/${i}.jpg`,
  stale: false,
  ...extra,
});

beforeEach(() => {
  db.rows = [];
  db.reviews = [];
  db.deletedFromCloudinary = [];
});

describe("the upload ceiling", () => {
  it("does not count photos the shop approved on reviews", async () => {
    db.rows = Array.from({ length: 2000 }, (_, i) => row(i, { keptFor: "approved-review" }));
    await expect(refuseIfStorageIsFull()).resolves.toBeUndefined();
  });

  it("sweeps before refusing, and lets the upload through when that frees room", async () => {
    // Full — but 50 of them are a month old and nobody claimed them.
    db.rows = Array.from({ length: 2000 }, (_, i) => row(i, { stale: i < 50 }));
    await expect(refuseIfStorageIsFull()).resolves.toBeUndefined();
    expect(db.rows).toHaveLength(1950);
    expect(db.deletedFromCloudinary).toHaveLength(50);
  });

  it("marks a photo on an APPROVED review as kept, and keeps counting a pending one", async () => {
    db.rows = Array.from({ length: 2000 }, (_, i) => row(i, { stale: i < 2 }));
    db.reviews = [
      { photoUrls: [db.rows[0].url], status: "approved" },
      { photoUrls: [db.rows[1].url], status: "pending" },
    ];
    // Both are claimed, so nothing is freed — but the approved one no longer counts.
    await expect(refuseIfStorageIsFull()).resolves.toBeUndefined();
    expect(db.rows.find((r) => r._id === "r0")?.keptFor).toBe("approved-review");
    expect(db.rows.find((r) => r._id === "r1")?.keptFor).toBeUndefined();
  });

  it("still refuses when the room really is used up", async () => {
    db.rows = Array.from({ length: 2000 }, (_, i) => row(i));
    await expect(refuseIfStorageIsFull()).rejects.toMatchObject({ status: 503 });
  });
});

describe("the body is measured before it is read", () => {
  const request = (length?: string) =>
    new Request("https://shop.test/api/uploads/photo-cake", {
      method: "POST",
      headers: length === undefined ? {} : { "content-length": length },
    });

  it("refuses a body declared far over the photo limit", () => {
    expect(() => refuseOversizedBody(request(String(300 * 1024 * 1024)))).toThrow(/too large/);
  });

  it("refuses a body that does not say its size", () => {
    expect(() => refuseOversizedBody(request())).toThrow();
  });

  it("lets a normal photo through", () => {
    expect(() => refuseOversizedBody(request(String(2 * 1024 * 1024)))).not.toThrow();
  });
});
