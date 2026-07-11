"use client";

import { useSyncExternalStore } from "react";
import { THEME_BLOCKING_SCRIPT } from "@/lib/theme";

const emptySubscribe = () => () => {};

/** True only during SSR and the matching hydration render. */
function useIsServerRender() {
  return useSyncExternalStore(
    emptySubscribe,
    () => false,
    () => true
  );
}

export function ThemeBlockingScript() {
  if (!useIsServerRender()) {
    return null;
  }

  return (
    <script
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: THEME_BLOCKING_SCRIPT }}
    />
  );
}
