/**
 * AN ORDER'S PHOTO IS ONE THIS SHOP TOOK.
 *
 * The photo-cake link on an order line was any string. It is loaded by every
 * kitchen and rider browser, linked in the admin and printed in the order
 * email — so a link to someone else's server told that server who works here,
 * and the picture could be changed after the order was placed.
 */
import { afterEach, describe, expect, it } from "vitest";

import { quoteSchema } from "@/features/checkout/server/checkout.validators";

const line = (photoUrl: string) => ({
  items: [{ productSlug: "photo-cake", quantity: 1, photoUrl }],
});
const OURS = "https://res.cloudinary.com/shopcloud/image/upload/v1/bakery-cms/photo-cakes/abc.jpg";

afterEach(() => {
  delete process.env.CLOUDINARY_CLOUD_NAME;
});

describe("the photo on an order line", () => {
  it("is accepted from this shop's own photo-cake uploads", () => {
    process.env.CLOUDINARY_CLOUD_NAME = "shopcloud";
    expect(quoteSchema.safeParse(line(OURS)).success).toBe(true);
  });

  it.each([
    ["another site", "https://evil.example/track.png"],
    ["another Cloudinary account", OURS.replace("shopcloud", "othercloud")],
    ["this shop's library, not a customer upload", "https://res.cloudinary.com/shopcloud/image/upload/v1/bakery-cms/logo.png"],
  ])("is refused from %s", (_, url) => {
    process.env.CLOUDINARY_CLOUD_NAME = "shopcloud";
    expect(quoteSchema.safeParse(line(url)).success).toBe(false);
  });

  it("is not judged when the shop has no image host to compare with", () => {
    expect(quoteSchema.safeParse(line("https://cdn.test/aarav.jpg")).success).toBe(true);
  });
});
