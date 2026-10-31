/**
 * THE ACTIVITY LOG READS AS SENTENCES.
 *
 * It printed each action's id with the dots taken out — "team invite link",
 * "auth login", "delivery zones replace", under an entity spelt
 * "Delivery_zones". A shop owner reads this list to find out who did what.
 */
import { describe, expect, it } from "vitest";

import { auditToActivity } from "@/features/audit/lib/audit-activity";
import type { AuditLogEntry } from "@/types/audit";

const entry = (action: string, status: AuditLogEntry["status"] = "success") =>
  auditToActivity({
    id: action,
    action,
    status,
    actorEmail: "owner@example.com",
    createdAt: "2026-10-31T10:00:00Z",
  } as AuditLogEntry);

describe("the activity log", () => {
  it.each([
    ["auth.login", "Signed in"],
    ["team.invite.link", "Made a new invitation link"],
    ["team.member.role", "Changed a member's role"],
    ["delivery_zones.replace", "Delivery zones updated"],
    ["order.refund.decline", "Refund declined"],
  ])("%s reads %s", (action, words) => {
    expect(entry(action).details).toBe(words);
  });

  it("an action nobody named still reads as a sentence", () => {
    expect(entry("settings.general.update").details).toBe("Settings general updated");
    expect(entry("site_layout.footer.replace").details).toBe("Site layout footer updated");
  });

  it("says when it failed", () => {
    expect(entry("auth.login", "failure").details).toBe("Signed in (failed)");
  });

  it("names the area without underscores", () => {
    expect(entry("delivery_zones.replace").entity).toBe("delivery zones");
  });
});
