import "server-only";

import { createHash } from "node:crypto";

import { connectDB } from "@/lib/server/db/mongoose";
import { ErrorLogModel } from "@/lib/server/db/models/error-log.model";

/**
 * Keeps a record of what went wrong, where the owner can see it.
 *
 * Server failures only reached `console.error`, which on the live site means a
 * host's log stream nobody in the shop reads — a checkout that broke for every
 * customer for a day left no trace the shop could find. Each failure is now
 * grouped into the `errorlogs` collection (see error-log.model.ts) and shown in
 * Settings → Error log.
 *
 * Never throws and never holds the request up: it is called from inside an
 * error path, and a second failure there must not replace the first.
 */

export interface ErrorReport {
  source: "server" | "browser";
  kind: string;
  message: string;
  stack?: string;
  path?: string;
  method?: string;
  route?: string;
  digest?: string;
  userAgent?: string;
}

/** Things that must not be written down, wherever they turn up in a message. */
const SECRETS: [RegExp, string][] = [
  [/([?&#](?:token|code|key|secret|password|signature|sig|auth)[^=&#\s]*=)[^&#\s]+/gi, "$1***"],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, "$1 ***"],
  [/\b(xkeysib|xsmtpsib|rzp_(?:live|test)|sk_(?:live|test))[-_A-Za-z0-9]+/g, "$1-***"],
  [/mongodb(\+srv)?:\/\/[^\s"']+/gi, "mongodb://***"],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, "***jwt***"],
];

export function scrubSecrets(text: string): string {
  return SECRETS.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

/** The path without its query string — a reset link's token lives there. */
export function cleanPath(path: string | undefined): string {
  return (path ?? "").split(/[?#]/)[0].slice(0, 300);
}

/**
 * Where + what, without the parts that change every time: ids, numbers and
 * order numbers in a message would otherwise make every occurrence "new".
 */
export function fingerprintOf(report: Pick<ErrorReport, "source" | "kind" | "message" | "route" | "path">): string {
  const where = report.route || cleanPath(report.path).replace(/\/[0-9a-f-]{8,}|\/\d+/gi, "/:id");
  const what = report.message.replace(/[0-9a-f]{24}|[0-9a-f-]{36}|\d+/gi, "#").slice(0, 200);
  return createHash("sha256").update(`${report.source}|${report.kind}|${where}|${what}`).digest("hex").slice(0, 32);
}

/** One write per kind of failure per 10 seconds from this server — a loop must not flood the database. */
const lastWritten = new Map<string, number>();
const QUIET_MS = 10_000;

export async function recordError(report: ErrorReport): Promise<void> {
  try {
    const message = scrubSecrets(report.message || "Unknown error").slice(0, 500);
    const entry = { ...report, message };
    const fingerprint = fingerprintOf(entry);

    const now = Date.now();
    if ((lastWritten.get(fingerprint) ?? 0) > now - QUIET_MS) return;
    lastWritten.set(fingerprint, now);
    if (lastWritten.size > 500) lastWritten.clear();

    await Promise.race([
      (async () => {
        await connectDB();
        await ErrorLogModel.updateOne(
          { fingerprint },
          {
            $set: {
              source: entry.source,
              kind: entry.kind,
              message,
              stack: scrubSecrets(entry.stack ?? "").split("\n").slice(0, 15).join("\n").slice(0, 4000),
              path: cleanPath(entry.path),
              method: (entry.method ?? "").slice(0, 10),
              route: (entry.route ?? "").slice(0, 200),
              digest: (entry.digest ?? "").slice(0, 100),
              userAgent: (entry.userAgent ?? "").slice(0, 200),
              lastSeenAt: new Date(now),
              // A failure that comes back is not dealt with after all.
              resolvedAt: null,
            },
            $inc: { count: 1 },
            $setOnInsert: { fingerprint, firstSeenAt: new Date(now) },
          },
          { upsert: true },
        );
      })(),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {
    // The error being recorded already went to the console; a failed write
    // must not become a second error on top of it.
  }
}
