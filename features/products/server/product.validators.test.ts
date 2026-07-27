import { describe, expect, it } from "vitest";

import { productFormSchema } from "./product.validators";

const valid = {
  name: "Chocolate Truffle",
  slug: "chocolate-truffle",
  description: "Rich and moist",
  price: 999,
  images: ["/a.jpg"],
  categoryId: "cat-1",
  occasionIds: [],
  weights: [{ label: "500g", price: 999 }],
  status: "published",
  isFeatured: false,
  isBestSeller: false,
  isTrending: false,
  isEggless: false,
  isPhotoCake: false,
  isSeasonal: false,
  shapes: ["Round"],
  flavourOptions: [],
  stockStatus: "in_stock",
  stockQuantity: 50,
  unlimitedStock: false,
  allowsMessage: true,
  allowsPhotoUpload: false,
  variantGroups: [],
  rating: 4.5,
  reviewCount: 12,
  seo: { metaTitle: "x" },
};

describe("productFormSchema", () => {
  it("accepts a valid product", () => {
    expect(productFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing name", () => {
    expect(productFormSchema.safeParse({ ...valid, name: "" }).success).toBe(false);
  });

  it("rejects an invalid slug", () => {
    expect(productFormSchema.safeParse({ ...valid, slug: "not a slug!" }).success).toBe(false);
  });

  it("rejects a negative price", () => {
    expect(productFormSchema.safeParse({ ...valid, price: -5 }).success).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(productFormSchema.safeParse({ ...valid, status: "live" }).success).toBe(false);
  });

  it("caps rating at 5", () => {
    expect(productFormSchema.safeParse({ ...valid, rating: 9 }).success).toBe(false);
  });

  it("keeps unknown extra fields (passthrough)", () => {
    const parsed = productFormSchema.parse({ ...valid, customField: "keep-me" });
    expect((parsed as Record<string, unknown>).customField).toBe("keep-me");
  });
});
