import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sweep is the entire reason the upload endpoint needs no account, and its
 * destructive branch had never run.
 *
 * The existing spec mocked `PhotoUploadModel.find` to return an empty array, so
 * the function returned at `if (!stale.length) return` and the delete was never
 * reached. Inverting the claim — deleting every ORDERED photo and keeping every
 * abandoned one — left the whole suite green. What that mechanism does was
 * verified by reading the source for a function name.
 *
 * The window was also 24 hours, which is not a cleanup rule, it is data loss: a
 * CART IS NOT AN ORDER. It lives in localStorage with no expiry, so somebody who
 * uploaded on Monday and bought on Wednesday placed an order pointing at a photo
 * the shop had already deleted.
 */
const store = vi.hoisted(() => ({
  stale: [] as { _id: string; publicId: string; url: string }[],
  ordered: [] as string[],
  drafted: [] as string[],
  deletedFromCloudinary: [] as string[],
  deletedRows: [] as string[],
  /** What the sweep asked for, so the window can be asserted rather than read. */
  findQuery: null as { createdAt?: { $lt?: Date } } | null,
}));

vi.mock("@/lib/server/db/mongoose", () => ({ connectDB: vi.fn(async () => undefined) }));

vi.mock("@/lib/server/media/cloudinary", () => ({
  isCloudinaryConfigured: () => true,
  uploadToCloudinary: vi.fn(async () => ({
    url: "https://cdn.example/new.png",
    publicId: "new",
    bytes: 10,
  })),
  deleteFromCloudinary: vi.fn(async (publicId: string) => {
    store.deletedFromCloudinary.push(publicId);
  }),
}));

vi.mock("@/lib/server/db/models/photo-upload.model", () => ({
  PhotoUploadModel: {
    create: vi.fn(async () => ({})),
    find: (query: { createdAt?: { $lt?: Date } }) => {
      store.findQuery = query;
      return { limit: () => ({ lean: async () => store.stale }) };
    },
    deleteOne: vi.fn(async (filter: { _id: string }) => {
      store.deletedRows.push(filter._id);
      return {};
    }),
  },
}));

const itemsFor = (urls: string[]) => [{ items: urls.map((photoUrl) => ({ photoUrl })) }];

vi.mock("@/lib/server/db/models/order.model", () => ({
  OrderModel: {
    find: () => ({ select: () => ({ lean: async () => itemsFor(store.ordered) }) }),
  },
}));
vi.mock("@/lib/server/db/models/checkout-draft.model", () => ({
  CheckoutDraftModel: {
    find: () => ({ select: () => ({ lean: async () => itemsFor(store.drafted) }) }),
  },
}));

/** A one-pixel PNG, because the upload sniffs magic bytes rather than trusting a name. */
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

/** The sweep runs on upload, so an upload is how it is driven. */
async function upload() {
  const { uploadPhotoCakeImage } = await import("@/features/uploads/server/photo-upload.service");
  return uploadPhotoCakeImage(new File([PNG], "p.png", { type: "image/png" }));
}

beforeEach(() => {
  store.stale = [];
  store.ordered = [];
  store.drafted = [];
  store.deletedFromCloudinary = [];
  store.deletedRows = [];
  store.findQuery = null;
});
afterEach(() => vi.clearAllMocks());

describe("sweeping the photos nothing claimed", () => {
  const ABANDONED = { _id: "r1", publicId: "abandoned", url: "https://cdn.example/a.png" };
  const ORDERED = { _id: "r2", publicId: "ordered", url: "https://cdn.example/b.png" };
  const DRAFTED = { _id: "r3", publicId: "drafted", url: "https://cdn.example/c.png" };

  it("deletes the abandoned one and only the abandoned one", async () => {
    store.stale = [ABANDONED, ORDERED];
    store.ordered = [ORDERED.url];

    await upload();

    // The assertion the old spec could not make: which asset actually went.
    expect(store.deletedFromCloudinary).toEqual(["abandoned"]);
    // Both rows go — the ordered photo belongs to an order now and nothing here
    // should look at it again.
    expect(store.deletedRows.sort()).toEqual(["r1", "r2"]);
  });

  it("treats a checkout draft as a claim", async () => {
    /**
     * A draft is written when a customer reaches payment and exists BEFORE the
     * order does. Without it a photo is unclaimed through exactly the minutes it
     * matters most — between pressing Pay and the order being written.
     */
    store.stale = [DRAFTED];
    store.drafted = [DRAFTED.url];

    await upload();

    expect(store.deletedFromCloudinary).toEqual([]);
  });

  it("keeps a photo for thirty days, not for a day", async () => {
    /**
     * 24 hours deleted real customers' photographs, because a cart is not an
     * order: it lives in localStorage with no expiry, and the server cannot see
     * it. The window is the only lever, so its value is pinned.
     */
    store.stale = [ABANDONED];

    await upload();

    const cutoff = store.findQuery?.createdAt?.$lt;
    expect(cutoff).toBeInstanceOf(Date);

    const daysAgo = (Date.now() - cutoff!.getTime()) / (24 * 60 * 60 * 1000);
    expect(daysAgo).toBeGreaterThan(28);
    expect(daysAgo).toBeLessThan(32);
  });

  it("deletes nothing when there is nothing old enough", async () => {
    await upload();

    expect(store.deletedFromCloudinary).toEqual([]);
    expect(store.deletedRows).toEqual([]);
  });
});
