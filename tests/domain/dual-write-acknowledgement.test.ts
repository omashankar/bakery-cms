/**
 * Every client dual-write in this repo writes localStorage first (so the UI is
 * instant) and then the server (which is the source of truth). The local write
 * always succeeds, so `persisted` is the only thing that distinguishes a saved
 * change from one that merely looks saved until the next hydration.
 *
 * These pin that contract across the modules where it was missing entirely: the
 * request was fire-and-forget, or the helper never checked `res.ok`, so a 401
 * from an expired token and a 500 both read as success.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addInquiry,
  deleteInquiries,
  updateInquiry,
} from "@/features/inquiries/lib/inquiries-repository";
import {
  addNewsletterSubscriber,
  deleteNewsletterSubscribers,
  updateNewsletterSubscriber,
} from "@/features/inquiries/lib/newsletter-repository";
import {
  approveReviews,
  createReview,
  deleteReviews,
  rejectReviews,
  setReviewStatus,
} from "@/features/reviews/lib/reviews-repository";
import {
  getActiveSessions,
  logoutAllDevices,
  persistServerSecurityCenter,
  revokeSession,
} from "@/features/settings/lib/security-center-repository";
import type { SecurityCenterState } from "@/types/security";

/** Stub the dual-write endpoints with a fixed HTTP outcome. */
function mockServer(ok: boolean, status = ok ? 200 : 500) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve({ success: ok, data: ok ? {} : null }),
  } as unknown as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const inquiry = {
  type: "contact" as const,
  name: "Asha Menon",
  email: "asha@example.com",
  message: "Do you make eggless cakes?",
};

const review = {
  cakeId: "cake-1",
  productSlug: "black-forest",
  cakeName: "Black Forest",
  authorName: "Asha",
  rating: 5,
  body: "Lovely",
  status: "pending" as const,
  isFeatured: false,
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("inquiry writes", () => {
  it("reports persisted only when the server accepted them", async () => {
    mockServer(true);
    const created = await addInquiry(inquiry);
    expect(created.persisted).toBe(true);

    mockServer(false);
    await expect(addInquiry(inquiry)).resolves.toMatchObject({ persisted: false });
    await expect(
      updateInquiry(created.inquiry!.id, { status: "replied" })
    ).resolves.toMatchObject({ persisted: false });
    await expect(deleteInquiries([created.inquiry!.id])).resolves.toMatchObject({
      persisted: false,
    });
  });

  it("reports NOT persisted when the request fails outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(addInquiry(inquiry)).resolves.toMatchObject({ persisted: false });
  });

  it("still applies locally, so the change is not lost while it is reported", async () => {
    mockServer(false);

    const { inquiry: created } = await addInquiry(inquiry);

    expect(created?.name).toBe("Asha Menon");
  });
});

describe("newsletter writes", () => {
  it("reports persisted only when the server accepted them", async () => {
    mockServer(true);
    const created = await addNewsletterSubscriber("asha@example.com");
    expect(created.persisted).toBe(true);

    mockServer(false);
    await expect(
      updateNewsletterSubscriber(created.subscriber!.id, { isActive: false })
    ).resolves.toMatchObject({ persisted: false });
    await expect(deleteNewsletterSubscribers([created.subscriber!.id])).resolves.toMatchObject({
      persisted: false,
    });
  });

  it("reports a rejected re-subscribe of a known email", async () => {
    mockServer(true);
    await addNewsletterSubscriber("asha@example.com");

    // The dedupe path returns the existing row — it must still carry the real
    // outcome of the PUBLIC subscribe request rather than assuming success.
    mockServer(false);
    await expect(addNewsletterSubscriber("asha@example.com")).resolves.toMatchObject({
      persisted: false,
    });
  });
});

describe("review moderation writes", () => {
  it("reports persisted only when the server accepted them", async () => {
    mockServer(true);
    const created = await createReview(review);
    expect(created.persisted).toBe(true);

    mockServer(false);
    await expect(setReviewStatus(created.review!.id, "approved")).resolves.toMatchObject({
      persisted: false,
    });
    await expect(deleteReviews([created.review!.id])).resolves.toMatchObject({ persisted: false });
  });

  it("counts a bulk moderation per id instead of assuming the batch went through", async () => {
    mockServer(true);
    const a = await createReview(review);
    const b = await createReview({ ...review, authorName: "Ravi" });
    const ids = [a.review!.id, b.review!.id];

    const fetchMock = mockServer(false);
    const rejected = await approveReviews(ids);

    // `ids.forEach(async …)` discarded every answer, so a batch the server
    // refused whole was indistinguishable from one it accepted whole.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(rejected).toEqual({ updated: 0, failed: 2 });

    mockServer(true);
    await expect(rejectReviews(ids)).resolves.toEqual({ updated: 2, failed: 0 });
  });
});

describe("session revocation", () => {
  /** Seed one revocable session alongside the current one. */
  function seedSessions() {
    persistServerSecurityCenter({
      loginHistory: [],
      failedAttempts: [],
      devices: [],
      activeSessions: [
        { id: "sess-current", isCurrent: true, device: "This browser" },
        { id: "sess-other", isCurrent: false, device: "Another laptop" },
      ],
    } as unknown as SecurityCenterState);
  }

  it("revokes only once the server confirms it", async () => {
    seedSessions();
    mockServer(true);

    await expect(revokeSession("sess-other")).resolves.toBe(true);
  });

  it("reports failure AND keeps the session listed when the server refuses", async () => {
    seedSessions();
    mockServer(false, 401); // e.g. the admin's own token just expired

    expect(await revokeSession("sess-other")).toBe(false);

    // The row must survive. Dropping it locally would tell the admin the session
    // is gone while it is still live, and remove the row they would retry from.
    expect(getActiveSessions().map((session) => session.id)).toContain("sess-other");
  });

  it("refuses to revoke the current session without asking the server", async () => {
    seedSessions();
    const fetchMock = mockServer(true);

    expect(await revokeSession("sess-current")).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports whether sign-out-everywhere actually reached the server", async () => {
    seedSessions();
    mockServer(false);
    await expect(logoutAllDevices()).resolves.toMatchObject({ removed: 1, persisted: false });

    seedSessions();
    mockServer(true);
    await expect(logoutAllDevices()).resolves.toMatchObject({ removed: 1, persisted: true });
  });
});
