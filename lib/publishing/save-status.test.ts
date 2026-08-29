/**
 * What each save button writes, for every state a record can already be in.
 *
 * The row that matters is `save` over `archived`. Both admin forms hardcoded
 * "draft" into their Save button, spread it over the form's own copy, and so
 * un-archived any retired cake or page the moment an admin opened it to fix a
 * typo and pressed Save. Nothing warned them; the record simply came back.
 */
import { describe, expect, it } from "vitest";

import { resolveSaveStatus, type SaveIntent } from "./save-status";
import type { EntityStatus } from "@/types/common";

const STORED: (EntityStatus | null)[] = ["draft", "published", "archived", null];

describe("what a save writes", () => {
  it.each(STORED)("publish always publishes, over a stored %s", (stored) => {
    expect(resolveSaveStatus("publish", stored)).toBe("published");
  });

  it.each(STORED)("archive always archives, over a stored %s", (stored) => {
    expect(resolveSaveStatus("archive", stored)).toBe("archived");
  });

  it.each(STORED)("unarchive always returns it to draft, from a stored %s", (stored) => {
    expect(resolveSaveStatus("unarchive", stored)).toBe("draft");
  });

  it("an ordinary save keeps an archived record archived", () => {
    // THE regression. Correcting a typo on a retired product must not put it
    // back on the shop.
    expect(resolveSaveStatus("save", "archived")).toBe("archived");
  });

  it("an ordinary save is otherwise a draft, including for a published record", () => {
    // Unpublishing is what the button says it does, and that stays true.
    expect(resolveSaveStatus("save", "published")).toBe("draft");
    expect(resolveSaveStatus("save", "draft")).toBe("draft");
    expect(resolveSaveStatus("save", null)).toBe("draft");
  });

  it("never invents a status outside the three that exist", () => {
    // Anti-vacuity: pins that the table above really exercises every branch,
    // and that no intent falls through to undefined.
    const intents: SaveIntent[] = ["save", "publish", "archive", "unarchive"];
    const produced = new Set(
      intents.flatMap((intent) => STORED.map((stored) => resolveSaveStatus(intent, stored))),
    );

    expect(produced).toEqual(new Set(["draft", "published", "archived"]));
  });
});
