"use client";

const reported = new WeakSet<object>();

/**
 * Tell the shop a page crashed in this browser (Settings → Error log).
 *
 * Called from the error boundaries. An error that carries a `digest` came from
 * the SERVER — the server already recorded it with the real message, and the
 * browser only sees a placeholder — so it is not sent twice. Once per error
 * object, because a boundary can render more than once for the same failure.
 */
export function reportClientError(error: Error & { digest?: string }): void {
  if (typeof window === "undefined" || error.digest || reported.has(error)) return;
  reported.add(error);
  try {
    void fetch("/api/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // The visitor may be leaving the broken page; let the report finish.
      keepalive: true,
      body: JSON.stringify({
        message: String(error.message || error.name || "Unknown error").slice(0, 500),
        stack: String(error.stack ?? "").slice(0, 4000),
        path: window.location.pathname.slice(0, 300),
      }),
    }).catch(() => undefined);
  } catch {
    // Reporting is best effort; the page is already showing its error screen.
  }
}
