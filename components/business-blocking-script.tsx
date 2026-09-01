"use client";

import { useEffect, useSyncExternalStore } from "react";
import { BUSINESS_BLOCKING_SCRIPT } from "@/lib/business-blocking";
import {
  getModuleSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";

const emptySubscribe = () => () => {};

/** True only during SSR and the matching hydration render. */
function useIsServerRender() {
  return useSyncExternalStore(emptySubscribe, () => false, () => true);
}

/**
 * Live-sync the root data-* flags after settings change (admin toggles, resets).
 *
 * Exported so a test can prove it agrees with the pre-paint string it takes
 * over from. `lib/business-blocking.ts` asks for the two to be kept in sync and
 * nothing checked that they were — they already disagreed for any stored value
 * that is neither `true` nor `false`, because that script asks `!== false` and
 * this asked for truthiness.
 */
export function applyBusinessAttributes() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const m = getModuleSettings();
  // `data-biz` was stamped here and read by nothing — not one CSS selector, not
  // one line of JS. It went with the business type it named.
  // `!== false`, exactly as the pre-paint script asks it. Only an explicit
  // `false` hides anything: every other value means the shop has not said, and
  // a gate that does not know must not take down a page a shop is selling from.
  const toggle = (attr: string, on: unknown) =>
    on !== false ? root.removeAttribute(attr) : root.setAttribute(attr, "0");
  toggle("data-wed", m.weddingBuilder);
  toggle("data-mod-flavour", m.flavour);
  toggle("data-mod-egg", m.eggEggless);
  toggle("data-mod-weight", m.weight);
  toggle("data-mod-shape", m.shape);
  toggle("data-mod-photo", m.photoCake);
}

/**
 * Renders the pre-paint inline script during SSR/hydration, and keeps the root
 * flags in sync on the client when settings change.
 */
export function BusinessBlockingScript() {
  useEffect(() => {
    applyBusinessAttributes();
    window.addEventListener(SETTINGS_UPDATED_EVENT, applyBusinessAttributes);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, applyBusinessAttributes);
  }, []);

  if (!useIsServerRender()) {
    return null;
  }

  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: BUSINESS_BLOCKING_SCRIPT }}
    />
  );
}
