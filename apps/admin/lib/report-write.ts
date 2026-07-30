import { toast } from "sonner";

/**
 * Report an admin write honestly, and tell the caller whether it may treat the
 * change as saved.
 *
 * Admin stores dual-write: localStorage first so the UI is instant, then the
 * server. The local half effectively cannot fail, so reporting success on it
 * alone tells the admin that the browser managed to talk to itself. The
 * `use*ServerSync` hooks then overwrite that copy from the server on the next
 * page load, so a rejected write is not saved — it is reverted, quietly, some
 * minutes later, by which time the admin has long since moved on.
 *
 * Pass the same phrase you would have used for success ("Banner created"); the
 * failure message is built from it so the two read as the same event.
 */
export function reportWrite(persisted: boolean, success: string): boolean {
  if (persisted) {
    toast.success(success);
    return true;
  }

  toast.error(`${success} on this device only — the server rejected it`, {
    description: "Reload to see the server's version, or try again.",
  });
  return false;
}
