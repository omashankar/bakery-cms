"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { CommerceSettings } from "@/types/settings";
import { defaultCommerceSettings } from "@/features/admin/settings/lib/settings-utils";
import {
  getCommerceSettings,
  saveCommerceSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/admin/settings/lib/settings-repository";

export function useCommerceSettingsForm() {
  const [settings, setSettings] = useState<CommerceSettings>(defaultCommerceSettings);
  const [savedSettings, setSavedSettings] = useState<CommerceSettings>(defaultCommerceSettings);

  useEffect(() => {
    function load() {
      const loaded = getCommerceSettings();
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
