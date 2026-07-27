import { describe, expect, it } from "vitest";

import {
  subscribeSchema,
  updateSubscriberSchema,
  deleteSubscribersSchema,
} from "./newsletter.validators";

describe("newsletter validators", () => {
  it("accepts a valid public subscribe", () => {
    expect(subscribeSchema.safeParse({ email: "fan@example.com", source: "Footer" }).success).toBe(true);
  });

  it("rejects a subscribe with a bad email", () => {
    expect(subscribeSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });

  it("accepts an activate/deactivate patch and rejects an empty patch", () => {
    expect(updateSubscriberSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(updateSubscriberSchema.safeParse({}).success).toBe(false);
  });

  it("validates the bulk delete payload", () => {
    expect(deleteSubscribersSchema.safeParse({ ids: ["sub-1"] }).success).toBe(true);
    expect(deleteSubscribersSchema.safeParse({ ids: [] }).success).toBe(false);
  });
});
