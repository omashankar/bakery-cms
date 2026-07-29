"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { CommerceSettings } from "@/types/settings";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import {
  getCommerceSettings,
  saveCommerceSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";

export function useCommerceSettingsForm() {
  const [settings, setSettings] = useState<CommerceSettings>(defaultCommerceSettings);
  const [savedSettings, setSavedSettings] = useState<CommerceSettings>(defaultCommerceSettings);

  // Snapshot for the SETTINGS_UPDATED listener so it can check dirtiness without
  // re-subscribing on every keystroke.
  const stateRef = useRef({ settings, savedSettings });
  stateRef.current = { settings, savedSettings };

  useEffect(() => {
    function load() {
      const loaded = getCommerceSettings();
      const { settings: current, savedSettings: currentSaved } = stateRef.current;
      // A background hydration must not clobber unsaved edits: skip the reset
      // while the form is dirty (mid-edit); resync only when pristine.
      if (JSON.stringify(current) !== JSON.stringify(currentSaved)) return;
      setSettings(loaded);
      setSavedSettings(loaded);
    }
    load();
    window.addEventListener(SETTINGS_UPDATED_EVENT, load);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, load);
  }, []);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  function save(successMessage = "Settings saved", nextSettings?: CommerceSettings) {
    const saved = saveCommerceSettings(nextSettings ?? settings);
    setSavedSettings(saved);
    setSettings(saved);
    toast.success(successMessage);
  }

  return {
    settings,
    setSettings,
    savedSettings,
    isDirty,
    save,
  };
}
