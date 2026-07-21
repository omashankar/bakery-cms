"use client";

import { useEffect, useSyncExternalStore } from "react";
import { BUSINESS_BLOCKING_SCRIPT } from "@/lib/business-blocking";
import {
  getGeneralSettings,
  getModuleSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";

const emptySubscribe = () => () => {};

/** True only during SSR and the matching hydration render. */
function useIsServerRender() {
  return useSyncExternalStore(emptySubscribe, () => false, () => true);
}

/** Live-sync the root data-* flags after settings change (admin toggles, resets). */
function applyBusinessAttributes() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const biz = getGeneralSettings().businessType;
  const m = getModuleSettings();
  root.setAttribute("data-biz", biz);
  const toggle = (attr: string, on: boolean) =>
    on ? root.removeAttribute(attr) : root.setAttribute(attr, "0");
  toggle("data-wed", biz === "bakery" && m.weddingBuilder);
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
