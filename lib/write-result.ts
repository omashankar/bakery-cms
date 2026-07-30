/**
 * The result of a client dual-write: the value, plus whether the SERVER took it.
 *
 * Every admin store in this codebase writes localStorage first (so the UI is
 * instant) and then the server (which is the source of truth). The local write
 * effectively cannot fail, so on its own it tells the caller nothing — and the
 * `use*ServerSync` hooks overwrite the local copy from the server on the next
 * admin page load, which means a change the server rejected is not saved. It is
 * reverted, silently, some minutes later.
 *
 * So `persisted` is the only honest basis for a success message. A caller that
 * toasts on the strength of the returned value alone is reporting that the
 * browser managed to talk to itself.
 */
export interface WriteResult<T> {
  value: T;
  persisted: boolean;
}
