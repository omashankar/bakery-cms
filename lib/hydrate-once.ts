/**
 * One hydration, however many callers ask for it.
 *
 * The admin layout fills every admin cache from a single deferred effect —
 * `useIdle(1000)`, so the screen the admin actually opened gets the connection
 * first. That is right for most screens and backwards for the ones whose OWN
 * content is one of those caches: the Reviews page reads `loadReviews()` and had
 * nothing to do for a second but wait out a delay meant to help it. Measured in
 * a production build, warm: the list appeared at ~2.1s, and its own request came
 * ~750ms after the first response on the page.
 *
 * The fix is for such a page to run its own sync immediately. That only works if
 * running a sync twice is free, which it was not — the hooks had no guard, so
 * the page's call and the layout's call a second later would both fetch.
 *
 * Keyed by name rather than by a hydration gate: the five hooks this covers
 * settle three different ways (a `HydrationGate`, a module-level flag, and one
 * with no completion signal at all), and a helper that only worked for the first
 * kind would have left the other two duplicating requests.
 */
const done = new Set<string>();
const inFlight = new Map<string, Promise<void>>();

/**
 * Runs `run` unless it has already succeeded, or is running now.
 *
 * Never rejects — callers are fire-and-forget effects, and an unhandled
 * rejection from a cache refresh is not something a screen should have to
 * catch. A FAILED run is not recorded as done, so the next screen that asks
 * gets a real attempt rather than the failure remembered for the session.
 */
export function hydrateOnce(key: string, run: () => Promise<void>): Promise<void> {
  if (done.has(key)) return Promise.resolve();

  const running = inFlight.get(key);
  if (running) return running;

  /**
   * Deliberately NOT cancelled when the component that started it unmounts.
   *
   * Two callers share this promise, so honouring the first one's cleanup would
   * abandon the second's read as well. These syncs write to a cache and dispatch
   * an update event — there is no React state to set late, so finishing after an
   * unmount costs nothing and leaves the cache warm for the next screen.
   */
  const started = run()
    .then(() => {
      done.add(key);
    })
    .catch(() => {
      // Left undone on purpose; see above.
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, started);
  return started;
}

/** Test seam. Production never needs this — the map lives for the page session. */
export function resetHydrateOnce(): void {
  done.clear();
  inFlight.clear();
}
