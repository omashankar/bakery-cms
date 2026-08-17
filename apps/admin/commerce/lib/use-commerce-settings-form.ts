"use client";

import { toast } from "sonner";
import type { CommerceSettings } from "@/types/settings";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import {
  getCommerceSettings,
  saveCommerceSettings,
} from "@/features/settings/lib/settings-repository";
import {
  useSettingsSection,
  type SectionHydration,
} from "@/features/settings/lib/use-settings-section";
import { reportedAsSignedOut } from "@/apps/admin/lib/report-write";

/**
 * The commerce section, for the admin screens that edit part of it.
 *
 * This used to hand-roll the form, and it carried the same defect the three
 * commerce screens were just fixed for: `load()` skipped the resync whenever the
 * form was dirty. That is right for protecting unsaved edits and wrong on a cold
 * load — `SettingsServerSync` reads the server's copy from a root-layout effect,
 * so that read is still in flight while the fields are already interactive, and
 * `getCommerceSettings()` answers with the demo seed meanwhile. One keystroke
 * pinned the seed, and Save PUT the WHOLE commerce section from it.
 *
 * That matters more here than it looks. Delivery Slots is a screen about time
 * slots, but the section it replaces also holds the tax rate, the delivery fees,
 * the gift wrap, the minimum order value and the checkout terms — so leaving
 * this hook alone would have left a fourth door into the settings the other
 * three screens had just been sealed against.
 *
 * `useSettingsSection` is the shared answer: it opens the gate on demand, adopts
 * what arrives before unlocking, and suppresses its own resync while a write is
 * in flight. `hydration` is returned so the caller can hold its fields closed —
 * gating only the Save button leaves the gap open.
 */
export interface CommerceSettingsForm {
  settings: CommerceSettings;
  setSettings: (update: (prev: CommerceSettings) => CommerceSettings) => void;
  savedSettings: CommerceSettings;
  isDirty: boolean;
  hydration: SectionHydration;
  /** True once it is safe to save: hydrated, and not mid-write. */
  canSave: boolean;
  isWriting: boolean;
  save: (successMessage?: string, nextSettings?: CommerceSettings) => Promise<void>;
}

export function useCommerceSettingsForm(): CommerceSettingsForm {
  const { settings, saved, isDirty, hydration, isWriting, canSave, edit, runWrite } =
    useSettingsSection<CommerceSettings>(getCommerceSettings, defaultCommerceSettings);

  async function save(successMessage = "Settings saved", nextSettings?: CommerceSettings) {
    if (!canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await saveCommerceSettings(nextSettings ?? settings);

      if (!persisted) {
        // `saved` is left where it was: the dirty flag is what keeps Save
        // enabled, and these are delivery fees and tax rates the storefront
        // charges against.
        if (!reportedAsSignedOut()) toast.error("Saved on this device only — the server rejected it", {
          description: "Your changes are still here. Try again, or reload to discard them.",
        });
        return { value, accepted: false };
      }

      toast.success(successMessage);
      return { value, accepted: true };
    });
  }

  return {
    settings,
    setSettings: edit,
    savedSettings: saved,
    isDirty,
    hydration,
    canSave,
    isWriting,
    save,
  };
}
