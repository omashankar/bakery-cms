/**
 * Stands in for the `server-only` package under vitest.
 *
 * The real package has no runtime behaviour at all — it exists so that importing
 * it from a client bundle is a BUILD error, which is how a module declares "this
 * must never reach the browser". Next resolves it during its own build; a plain
 * vitest run cannot, so every module carrying the guard became untestable, along
 * with everything that imports one transitively.
 *
 * Empty on purpose. The guard still does its job where it matters.
 */
export {};
