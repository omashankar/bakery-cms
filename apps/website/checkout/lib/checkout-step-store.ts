import { useSyncExternalStore } from "react";

/**
 * Which purchase step the page is on, for the focused header to draw.
 *
 * The steps live in the HEADER now, as the owner's reference has them — but the
 * header is part of the layout and the step is the checkout page's own state
 * (it moves without a navigation). The page publishes here; the header reads.
 * `null` until a page publishes, and the header then falls back to the step
 * its path implies, so the server render and the first paint already agree.
 */
export interface CheckoutStepState {
  step: 0 | 1 | 2 | 3;
  /** Going back to a completed step, where the page allows it. */
  onSelect?: (step: 1 | 2 | 3) => void;
  /** No steps at all — an empty cart, where a checkout bar implies a checkout that is not happening. */
  hidden?: boolean;
}

let state: CheckoutStepState | null = null;
const listeners = new Set<() => void>();

export function publishCheckoutStep(next: CheckoutStepState | null): void {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useCheckoutStep(): CheckoutStepState | null {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => null,
  );
}
