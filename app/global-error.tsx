"use client";

import { useEffect } from "react";

import { reportClientError } from "@/features/error-log/lib/report-client-error";

/**
 * The last resort: the root layout itself failed, so nothing else — not the
 * shop's header, styles or fonts — can be relied on. Plain markup, one way
 * back, and the failure recorded in Settings → Error log.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error), [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <main
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: 24,
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 22, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#6b6b6b", margin: 0, maxWidth: 420 }}>
            Sorry about that. Please try again in a moment.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
