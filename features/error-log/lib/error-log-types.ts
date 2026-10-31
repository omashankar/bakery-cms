/** One kind of failure, as Settings → Error log shows it. */
export interface ErrorLogView {
  id: string;
  /** Where it happened: on the server, or in a visitor's browser. */
  source: "server" | "browser";
  /** "page", "api", "action", "proxy" or "browser". */
  kind: string;
  message: string;
  stack: string;
  path: string;
  method: string;
  digest: string;
  /** How many times it has happened (writes are spaced 10s apart per server). */
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}
