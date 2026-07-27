import { describe, expect, it } from "vitest";

import { contentSchemas } from "./content.validators";

describe("content validators", () => {
  it("accepts a valid banners array", () => {
    expect(
      contentSchemas.banners.safeParse([{ id: "b1", title: "Hero", image: "/x.jpg", isActive: true }])
        .success,
    ).toBe(true);
  });

  it("rejects a banner without an id", () => {
    expect(contentSchemas.banners.safeParse([{ title: "Hero" }]).success).toBe(false);
  });

  it("accepts a valid testimonials array and keeps extra fields", () => {
    const parsed = contentSchemas.testimonials.parse([
      { id: "t1", name: "Asha", content: "Great", rating: 5, status: "published" },
    ]);
    expect((parsed[0] as Record<string, unknown>).rating).toBe(5);
  });

  it("rejects a testimonial without a name", () => {
    expect(contentSchemas.testimonials.safeParse([{ id: "t1", content: "x" }]).success).toBe(false);
  });

  it("rejects an FAQ without a question", () => {
    expect(contentSchemas.faq.safeParse([{ id: "f1", answer: "x" }]).success).toBe(false);
  });

  it("exposes the three content collections", () => {
    expect(Object.keys(contentSchemas).sort()).toEqual(["banners", "faq", "testimonials"]);
  });
});
