"use client";

import { useEffect, useRef } from "react";
import {
  APPEARANCE_UPDATED_EVENT,
  applyAppearanceSettingsTo,
} from "@/apps/admin/appearance/lib/appearance-utils";
import {
  APPEARANCE_STORAGE_KEY,
  loadAppearanceSettings,
} from "@/apps/admin/appearance/lib/appearance-repository";
import { cn } from "@/lib/utils";

interface StorefrontLightFrameProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Forces the website light design system inside admin (builder previews).
 * Same tokens as live /store — Appearance brand colors included.
 */
export function StorefrontLightFrame({
  children,
  className,
}: StorefrontLightFrameProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function sync() {
      if (!ref.current) return;
      applyAppearanceSettingsTo(ref.current, loadAppearanceSettings(), {
        forceSemantics: true,
      });
    }

    sync();
    window.addEventListener(APPEARANCE_UPDATED_EVENT, sync);
    function onStorage(event: StorageEvent) {
      if (event.key !== APPEARANCE_STORAGE_KEY) return;
      sync();
    }
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(APPEARANCE_UPDATED_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={cn("storefront-light bg-background text-foreground", className)}
      data-storefront-theme="light"
      style={{ colorScheme: "light" }}
    >
      {children}
    </div>
  );
}
