// A non-UTC zone, set before anything in this file touches Date.
//
// In UTC every assertion below passes against the BROKEN implementation too —
// the bug is exactly the loss of the UTC offset — so a test that ran in UTC
// would be green and worthless. The first assertion checks the zone actually
// took effect rather than trusting it.
process.env.TZ = "Asia/Kolkata";

import { describe, expect, it } from "vitest";

import {
  fromScheduleInputValue,
  toScheduleInputValue,
} from "@/apps/admin/builders/shared/schedule-time";

/** What the builder used to do: format the UTC instant and feed it to a local input. */
function theOldWay(iso: string): string {
  return new Date(iso).toISOString().slice(0, 16);
}

describe("the builder's scheduled-publish field", () => {
  it("runs in a zone where the bug is observable", () => {
    // 03:30Z is 09:00 in Asia/Kolkata. If this fails the process ignored TZ and
    // every other assertion here would be vacuous.
    expect(new Date("2026-08-10T03:30:00.000Z").getHours()).toBe(9);
    expect(new Date().getTimezoneOffset()).not.toBe(0);
  });

  it("shows the admin the wall-clock time they picked, not the UTC one", () => {
    // The admin typed 10 Aug 09:00 into <input type="datetime-local">, so the
    // stored instant is 03:30Z. Reopening the builder has to put 09:00 back in
    // the field — it used to put 03:30 there, and the field visibly jumped.
    expect(toScheduleInputValue("2026-08-10T03:30:00.000Z")).toBe("2026-08-10T09:00");
    expect(theOldWay("2026-08-10T03:30:00.000Z")).toBe("2026-08-10T03:30");
  });

  it("survives a save/reload/save cycle without moving the publish instant", () => {
    // The drift compounded: each round trip re-encoded the displayed value as
    // local, so a 9am launch walked backwards 5h30m per save.
    const chosen = "2026-08-10T09:00";
    let stored = fromScheduleInputValue(chosen);
    expect(stored).toBe("2026-08-10T03:30:00.000Z");

    for (let cycle = 0; cycle < 5; cycle += 1) {
      const shown = toScheduleInputValue(stored);
      expect(shown).toBe(chosen);
      stored = fromScheduleInputValue(shown);
      expect(stored).toBe("2026-08-10T03:30:00.000Z");
    }

    // The same loop with the old formatter walks the instant backwards.
    const drifted = fromScheduleInputValue(theOldWay("2026-08-10T03:30:00.000Z"));
    expect(drifted).toBe("2026-08-09T22:00:00.000Z");
  });

  it("round-trips any instant to the minute", () => {
    for (const iso of [
      "2026-01-01T00:00:00.000Z",
      "2026-06-30T18:29:00.000Z",
      "2026-12-31T23:59:00.000Z",
      "2027-03-15T06:45:00.000Z",
    ]) {
      expect(fromScheduleInputValue(toScheduleInputValue(iso))).toBe(iso);
    }
  });

  it("treats an empty or unusable value as no schedule", () => {
    expect(toScheduleInputValue(null)).toBe("");
    expect(toScheduleInputValue(undefined)).toBe("");
    expect(toScheduleInputValue("")).toBe("");
    expect(toScheduleInputValue("not a date")).toBe("");
    expect(fromScheduleInputValue("")).toBeNull();
    expect(fromScheduleInputValue("not a date")).toBeNull();
  });
});
