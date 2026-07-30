/**
 * Guards a REPLACE-ALL dual-write against clobbering the server with a local
 * cache that was never loaded from it.
 *
 * Several admin stores — banners, testimonials, FAQ, coupons, delivery zones,
 * header, footer, SEO, catalog, media, templates — push their ENTIRE local list
 * on every mutation, because the endpoints are whole-collection replaces. That
 * is only safe once the server's copy has been read INTO that list, which is
 * what the `*ServerSync` components do on mount.
 *
 * Nothing enforced the ordering. If that read failed (server down, an expired
 * admin token) or simply had not finished, the local list was still the demo
 * seed — and creating a single banner would send seed + new, overwriting every
 * real banner the shop had. One click, silent, unrecoverable without a backup.
 *
 * So a replace-all writer waits for hydration instead of racing it, and refuses
 * rather than send a list it cannot vouch for.
 */
export interface HydrationGate {
  /** True once the server's copy has been loaded into the local cache. */
  hasSettled(): boolean;
  /** Called by the sync component when the read SUCCEEDED. */
  markSettled(): void;
  /**
   * Resolves true once hydration settles, false if it has not within
   * `timeoutMs`. Already-settled resolves immediately, which is the normal case
   * — the sync runs on mount and a mutation needs a human first.
   */
  waitForSettled(timeoutMs?: number): Promise<boolean>;
}

/** Long enough for a cold serverless read, short enough not to look frozen. */
const DEFAULT_TIMEOUT_MS = 8000;

export function createHydrationGate(): HydrationGate {
  let settled = false;
  const waiting: Array<(ok: boolean) => void> = [];

  return {
    hasSettled: () => settled,

    markSettled() {
      if (settled) return;
      settled = true;
      while (waiting.length > 0) waiting.pop()?.(true);
    },

    waitForSettled(timeoutMs = DEFAULT_TIMEOUT_MS) {
      if (settled) return Promise.resolve(true);

      return new Promise<boolean>((resolve) => {
        let done = false;
        const finish = (ok: boolean) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve(ok);
        };

        const timer = setTimeout(() => finish(false), timeoutMs);
        waiting.push(finish);
      });
    },
  };
}
