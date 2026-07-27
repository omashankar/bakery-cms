import { describe, expect, it } from "vitest";

import {
  createInquirySchema,
  updateInquirySchema,
  deleteInquiriesSchema,
} from "./inquiry.validators";

describe("inquiry validators", () => {
  it("accepts a valid public contact inquiry", () => {
    expect(
      createInquirySchema.safeParse({
        type: "contact",
        name: "Priya",
        email: "priya@example.com",
        message: "Need a custom cake",
      }).success,
    ).toBe(true);
  });

  it("accepts a wedding inquiry with event metadata + client id", () => {
    expect(
      createInquirySchema.safeParse({
        id: "inq-123",
        type: "wedding",
        name: "Meera",
        email: "meera@example.com",
        message: "3-tier cake",
        eventDate: "2026-12-18",
        guestCount: 250,
        createdAt: "2026-07-27T00:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("rejects an inquiry with a bad email", () => {
    expect(
      createInquirySchema.safeParse({
        type: "contact",
        name: "X",
        email: "not-an-email",
        message: "hi",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown inquiry type", () => {
    expect(
      createInquirySchema.safeParse({
        type: "spam",
        name: "X",
        email: "x@example.com",
        message: "hi",
      }).success,
    ).toBe(false);
  });

  it("accepts a status/notes patch and rejects an empty patch", () => {
    expect(updateInquirySchema.safeParse({ status: "replied" }).success).toBe(true);
    expect(updateInquirySchema.safeParse({ notes: "Called back" }).success).toBe(true);
    expect(updateInquirySchema.safeParse({}).success).toBe(false);
  });

  it("rejects a patch with an invalid status", () => {
    expect(updateInquirySchema.safeParse({ status: "archived" }).success).toBe(false);
  });

  it("validates a bulk delete payload", () => {
    expect(deleteInquiriesSchema.safeParse({ ids: ["inq-1", "inq-2"] }).success).toBe(true);
    expect(deleteInquiriesSchema.safeParse({ ids: [] }).success).toBe(false);
  });
});
