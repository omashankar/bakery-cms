import { describe, expect, it } from "vitest";

import { mediaFilesSchema, mediaFoldersSchema, uploadSchema } from "./media.validators";

describe("media validators", () => {
  it("accepts a valid media files array", () => {
    expect(
      mediaFilesSchema.safeParse([
        { id: "m1", url: "https://cdn/x.jpg", name: "x", type: "image", publicId: "bakery/x" },
      ]).success,
    ).toBe(true);
  });

  it("rejects a media file without a url", () => {
    expect(mediaFilesSchema.safeParse([{ id: "m1", name: "x" }]).success).toBe(false);
  });

  it("accepts valid folders", () => {
    expect(mediaFoldersSchema.safeParse([{ id: "f1", name: "Cakes" }]).success).toBe(true);
  });

  it("rejects a folder without a name", () => {
    expect(mediaFoldersSchema.safeParse([{ id: "f1", name: "" }]).success).toBe(false);
  });

  it("validates upload input", () => {
    expect(uploadSchema.safeParse({ source: "data:image/png;base64,AAAA" }).success).toBe(true);
    expect(uploadSchema.safeParse({ source: "" }).success).toBe(false);
  });
});
