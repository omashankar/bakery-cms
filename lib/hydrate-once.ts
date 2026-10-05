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

/**
 * ONE READ, HOWEVER MANY CALLERS — for a read whose ANSWER matters.
 *
 * `hydrateOnce` above is for a fire-and-forget cache fill: it swallows the
 * result and remembers success by key. The `ensure…Hydrated` openers cannot use
 * it. Their caller waits on the boolean to decide whether a form may unlock,
 * and their reads never throw — `getJson` catches and returns null — so a
 * PARTIAL read resolves, the key is recorded as done, and the gate can never be
 * opened again for the life of the page. That would defeat the opener's whole
 * purpose and make a backup restore refuse every site-layout section it never
 * touched.
 *
 * So: share the promise, remember nothing. The caller's own `HydrationGate`
 * records success, and it is what decides whether a replace-all may be sent. A
 * finished read — accepted or refused — is forgotten, so a failed one is
 * retriable; the same rule `hydrateOnce` follows, for the same reason.
 */
const shared = new Map<string, Promise<unknown>>();

export function shareHydration<T>(key: string, run: () => Promise<T>): Promise<T> {
  const running = shared.get(key) as Promise<T> | undefined;
  if (running) return running;

  const started = run();
  shared.set(key, started);
  const forget = () => {
    /*
      Only if it is still ours. An earlier read settling must not drop a later
      one from the map, or the next caller starts a third.
    */
    if (shared.get(key) === started) shared.delete(key);
  };
  void started.then(forget, forget);
  return started;
}

/** Test seam. Production never needs this — the map lives for the page session. */
export function resetHydrateOnce(): void {
  done.clear();
  inFlight.clear();
  shared.clear();
}
