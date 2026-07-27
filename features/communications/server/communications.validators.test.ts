import { describe, expect, it } from "vitest";

import { templateSchemas, notificationSettingsSchema } from "./communications.validators";

describe("communications validators", () => {
  it("accepts a valid email template array", () => {
    expect(
      templateSchemas["email-templates"].safeParse([
        {
          id: "email-welcome",
          slug: "welcome",
          name: "Welcome email",
          subject: "Hi",
          body: "Hello {{customer_name}}",
          category: "transactional",
          status: "active",
          variables: ["customer_name"],
        },
      ]).success,
    ).toBe(true);
  });

  it("rejects an email template without an id", () => {
    expect(
      templateSchemas["email-templates"].safeParse([{ slug: "welcome", name: "x" }]).success,
    ).toBe(false);
  });

  it("accepts a valid whatsapp template array", () => {
    expect(
      templateSchemas["whatsapp-templates"].safeParse([
        { id: "wa-welcome", slug: "welcome", name: "Welcome", body: "Hi {{customer_name}}" },
      ]).success,
    ).toBe(true);
  });

  it("rejects a whatsapp template without a slug", () => {
    expect(
      templateSchemas["whatsapp-templates"].safeParse([{ id: "wa-1", name: "x" }]).success,
    ).toBe(false);
  });

  it("accepts valid notification settings", () => {
    expect(
      notificationSettingsSchema.safeParse({
        orderAlerts: true,
        paymentAlerts: false,
        stockAlerts: true,
        inquiryAlerts: false,
      }).success,
    ).toBe(true);
  });

  it("rejects notification settings with a non-boolean flag", () => {
    expect(
      notificationSettingsSchema.safeParse({
        orderAlerts: "yes",
        paymentAlerts: true,
        stockAlerts: true,
        inquiryAlerts: true,
      }).success,
    ).toBe(false);
  });
});
