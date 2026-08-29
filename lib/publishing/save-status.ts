import type { EntityStatus } from "@/types/common";

/**
 * What a save BUTTON means, as opposed to what status it writes.
 *
 * The forms used to hand a status straight to their save function, which then
 * spread it over the form's own copy — `{ ...form, status }` — so the button's
 * hardcoded literal always won. That made the Status dropdown beside it inert,
 * and it had a worse consequence than a dead control: opening an ARCHIVED cake
 * to fix a typo and pressing Save Draft silently un-archived it, because the
 * button had no way to say "leave the visibility alone".
 *
 * Buttons name an intent now. A status is derived from the intent and from what
 * the SERVER currently holds, in one place, so no screen can write a status its
 * own controls never offered.
 */
export type SaveIntent = "save" | "publish" | "archive" | "unarchive";

/**
 * The status a save should write.
 *
 * @param savedStatus what the server holds today, or null for a new record.
 *
 * `save` is the interesting one: it PRESERVES an archived record's visibility,
 * because an admin correcting a description has not asked for the thing to go
 * back on the shop. For anything else it means draft, which is what the button
 * saying "Save Draft" has always meant — including for a published record,
 * where saving a draft is a deliberate unpublish and the label says so.
 *
 * `publish` always publishes, archived or not: restoring a retired item is a
 * legitimate thing to want, and the button that does it says "Publish".
 */
export function resolveSaveStatus(
  intent: SaveIntent,
  savedStatus: EntityStatus | null,
): EntityStatus {
  switch (intent) {
    case "publish":
      return "published";
    case "archive":
      return "archived";
    case "unarchive":
      return "draft";
    case "save":
      return savedStatus === "archived" ? "archived" : "draft";
  }
}
