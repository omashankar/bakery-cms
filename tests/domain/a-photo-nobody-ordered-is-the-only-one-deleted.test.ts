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
  /** Photos a REVIEW carries — a claim of draft strength, not order strength. */
  reviewed: [] as string[],
  deletedFromCloudinary: [] as string[],
  deletedRows: [] as string[],
  /** Rows a DRAFT claimed — kept and asked again later, not dropped. */
  pushedForward: [] as string[],
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
    updateOne: vi.fn(async (filter: { _id: string }) => {
      store.pushedForward.push(filter._id);
      return {};
    }),
  },
}));

/**
 * The claim queries, ANSWERED PROPERLY.
 *
 * These mocks took no argument, so `find({ “items.photoUrl”: { $in: urls } })`
 * and `.select(“items”)` were never checked — point the path at a field that
 * does not exist and every ordered photo is destroyed on day thirty with the
 * suite green. They filter on what they were actually asked for.
 */
function claimSource(urls: () => string[]) {
  return {
    find: (query: Record<string, { $in?: string[] }>) => {
      const wanted = query["items.photoUrl"]?.$in ?? [];
      const matching = urls().filter((url) => wanted.includes(url));
      return {
        select: (fields: string) => ({
          lean: async () =>
            fields.includes("items")
              ? [{ items: matching.map((photoUrl) => ({ photoUrl })) }]
              : [{}],
        }),
      };
    },
  };
}

vi.mock("@/lib/server/db/models/order.model", () => ({
  OrderModel: claimSource(() => store.ordered),
}));
vi.mock("@/lib/server/db/models/checkout-draft.model", () => ({
  CheckoutDraftModel: claimSource(() => store.drafted),
}));
/**
 * Reviews name their photos on the review itself, not inside an items array,
 * so this answers the query it is actually asked rather than reusing the one
 * above — a mock that ignores its filter is how the destructive branch got to
 * ship untested in the first place.
 */
vi.mock("@/lib/server/db/models/review.model", () => ({
  ReviewModel: {
    find: (query: Record<string, { $in?: string[] }>) => {
      const wanted = query.photoUrls?.$in ?? [];
      const matching = store.reviewed.filter((url) => wanted.includes(url));
      return {
        select: (fields: string) => ({
          lean: async () =>
            fields.includes("photoUrls") ? [{ photoUrls: matching }] : [{}],
        }),
      };
    },
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
  store.reviewed = [];
  store.deletedFromCloudinary = [];
  store.deletedRows = [];
  store.pushedForward = [];
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

  it("keeps the row a draft claimed, and asks again later", async () => {
    /**
     * A claimed photo used to lose its row unconditionally, justified as “it
     * belongs to an order now” — which is not true of a DRAFT. A draft is
     * provisional and expires, so dropping the row on its word leaves an asset
     * whose Cloudinary id exists nowhere and which nothing can ever delete.
     */
    store.stale = [DRAFTED];
    store.drafted = [DRAFTED.url];

    await upload();

    expect(store.deletedFromCloudinary).toEqual([]);
    expect(store.deletedRows).toEqual([]);
    expect(store.pushedForward).toEqual(["r3"]);
  });

  it("lets an ORDER take the row with it", async () => {
    store.stale = [ORDERED];
    store.ordered = [ORDERED.url];

    await upload();

    expect(store.deletedFromCloudinary).toEqual([]);
    expect(store.deletedRows).toEqual(["r2"]);
    expect(store.pushedForward).toEqual([]);
  });

  it("asks the right question of the orders", async () => {
    /**
     * The two queries decide what “claimed” MEANS, and the mocks used to ignore
     * both the filter and the projection — so pointing the path at a field that
     * does not exist destroyed every ordered photo with the suite green.
     */
    store.stale = [ABANDONED, ORDERED];
    store.ordered = [ORDERED.url];

    await upload();

    // The ordered one survived, which is only possible if the filter matched
    // on the URL and the projection returned `items`.
    expect(store.deletedFromCloudinary).toEqual(["abandoned"]);
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

describe("a photo attached to a review", () => {
  const REVIEWED = { _id: "r4", publicId: "reviewed", url: "https://cdn.example/d.png" };

  it("is not deleted out from under the review that shows it", async () => {
    /**
     * A review photo is claimed by nothing an order or a draft knows about, so
     * thirty days after it was uploaded the sweep destroyed it — and the review
     * went on rendering a broken image on the product page for as long as it
     * stood.
     */
    store.stale = [REVIEWED];
    store.reviewed = [REVIEWED.url];

    await upload();

    expect(store.deletedFromCloudinary).not.toContain("reviewed");
  });

  it("keeps the row, so a deleted review does not strand the file forever", async () => {
    /**
     * Draft strength, not order strength. An order is final and takes the row
     * with it — nothing will ever need to delete that photo again. A review can
     * be rejected and deleted by a moderator, and dropping the row would leave
     * an asset whose Cloudinary id exists nowhere and which nothing can clean
     * up. Keeping it means the question is simply asked again in thirty days.
     */
    store.stale = [REVIEWED];
    store.reviewed = [REVIEWED.url];

    await upload();

    expect(store.deletedRows).not.toContain("r4");
    expect(store.pushedForward).toContain("r4");
  });

  it("still deletes one no review mentions", async () => {
    store.stale = [REVIEWED];
    store.reviewed = ["https://cdn.example/somebody-elses.png"];

    await upload();

    expect(store.deletedFromCloudinary).toContain("reviewed");
  });
});
