"use client";

import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  reportSettingsReset,
  reportSettingsWrite,
} from "@/apps/admin/settings/lib/report-settings-write";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { cn } from "@/lib/utils";
import type { BusinessHoursEntry, ContactSettings } from "@/types/settings";
import {
  defaultContactSettings,
  isValidEmailAddress,
  isValidMapEmbedUrl,
  normalizeMapEmbedUrl,
} from "@/features/settings/lib/settings-utils";
import {
  getContactSettings,
  resetContactSettings,
  saveContactSettings,
} from "@/features/settings/lib/settings-repository";
import { useSettingsSection } from "@/features/settings/lib/use-settings-section";
import { SettingsSectionShell } from "./settings-section-shell";
import { FieldError, SettingsHydrationNotice } from "./settings-field-error";

/**
 * The rule is `isValidEmailAddress`, which IS `z.email()` — not a regex
 * restating it.
 *
 * The regex that used to live here claimed to match Zod "deliberately" and did
 * not, in either direction. An address with an apostrophe — `o'brien@bakery.ie`,
 * legal, and accepted by the server — was refused here, so Save stayed disabled
 * for the WHOLE Contact section and the shop could not change its address,
 * phone or opening hours either.
 */

/** Everything the server will reject, checked here first. */
function validate(settings: ContactSettings) {
  const email = settings.email.trim();
  const blankHours = settings.businessHours.some(
    (item) => !item.day.trim() || !item.hours.trim()
  );

  return {
    email: !email || isValidEmailAddress(email) ? "" : "Enter a valid email address.",
    // Normalise FIRST, exactly as the server does. Checking the raw value meant
    // a document already holding Google's `<iframe>` snippet — the precise state
    // this feature exists to repair — reported an error the server would not,
    // and `saveDisabled` then froze every other field in the section.
    mapEmbedUrl: isValidMapEmbedUrl(normalizeMapEmbedUrl(settings.mapEmbedUrl ?? ""))
      ? ""
      : "Must be an https:// URL. Paste the embed link — or the whole <iframe> snippet, which is unwrapped for you.",
    businessHours: blankHours
      ? "Every row needs a day and hours, or remove it — a blank row shows as an empty line on the site."
      : "",
  };
}

export function ContactSettingsPage() {
  const { settings, isDirty, hydration, isWriting, canSave, edit, discard, runWrite } =
    useSettingsSection<ContactSettings>(getContactSettings, defaultContactSettings);

  const errors = validate(settings);
  const hasErrors = Object.values(errors).some(Boolean);
  const emailSet = Boolean(settings.email.trim());
  const hoursCount = settings.businessHours.length;

  function updateHours(index: number, patch: Partial<BusinessHoursEntry>) {
    edit((prev) => ({
      ...prev,
      businessHours: prev.businessHours.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      ),
    }));
  }

  function addHoursRow() {
    edit((prev) => ({
      ...prev,
      businessHours: [...prev.businessHours, { day: "New day", hours: "9:00 AM – 5:00 PM" }],
    }));
  }

  function removeHoursRow(index: number) {
    edit((prev) => ({
      ...prev,
      businessHours: prev.businessHours.filter((_, i) => i !== index),
    }));
  }

  async function handleSave() {
    if (hasErrors || !canSave) return;
    // `runWrite` keeps the hydration listener from re-baselining `saved` while
    // this is in flight — the local write dispatches SETTINGS_UPDATED_EVENT
    // synchronously, long before the server answers.
    await runWrite(async () => {
      const { value, persisted } = await saveContactSettings(settings);
      // Only mark clean when the SERVER has it — the dirty flag is what keeps
      // the Save button enabled, and greying it out removes the only retry.
      return { value, accepted: reportSettingsWrite(persisted, "Contact settings") };
    });
  }

  function handleDiscard() {
    discard();
    toast.message("Discarded unsaved changes");
  }

  async function handleReset() {
    if (!canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await resetContactSettings();
      return { value, accepted: reportSettingsReset(persisted, "Contact settings") };
    });
  }

  return (
    <SettingsSectionShell
      title="Contact"
      description={
        hydration === "ready"
          ? `${emailSet ? settings.email : "No email"} · ${hoursCount} hour row${hoursCount === 1 ? "" : "s"}`
          : "Business contact details shown on the contact page and footer."
      }
      isDirty={isDirty}
      // The fields stay behind the skeleton until the SERVER's copy has landed.
      // Letting the admin edit the seed and then blocking the correction (the
      // resync skips a dirty form) is how one keystroke pushed demo data over a
      // real shop's address, phone, map and hours.
      mounted={hydration !== "pending"}
      isSaving={isWriting}
      saveDisabled={hasErrors || !canSave}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
      // Reset sits outside the gated form, so without this it is clickable
      // before hydration and its handler simply returns.
      resetDisabled={!canSave}
    >
      <SettingsHydrationNotice hydration={hydration} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Contact details</CardTitle>
            <CardDescription>Primary ways customers can reach your bakery.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                className={cn(errors.email && "border-destructive")}
                onChange={(e) => edit((prev) => ({ ...prev, email: e.target.value }))}
              />
              <FieldError id="email-error" message={errors.email} />
              <p className="text-xs text-muted-foreground">
                Shown as the &quot;Email us&quot; link on the contact page and in the footer.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={settings.phone}
                onChange={(e) => edit((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <textarea
                id="address"
                className={adminTextareaClassName}
                value={settings.address}
                onChange={(e) => edit((prev) => ({ ...prev, address: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mapEmbedUrl">Google Maps embed URL</Label>
              <textarea
                id="mapEmbedUrl"
                className={cn(adminTextareaClassName, errors.mapEmbedUrl && "border-destructive")}
                value={settings.mapEmbedUrl ?? ""}
                aria-invalid={Boolean(errors.mapEmbedUrl)}
                aria-describedby={errors.mapEmbedUrl ? "mapEmbedUrl-error" : undefined}
                // Unwrapped on paste rather than on save, so the admin can SEE
                // what was stored instead of finding out from a blank map later.
                onChange={(e) =>
                  edit((prev) => ({ ...prev, mapEmbedUrl: normalizeMapEmbedUrl(e.target.value) }))
                }
                rows={3}
              />
              <FieldError id="mapEmbedUrl-error" message={errors.mapEmbedUrl} />
              <p className="text-xs text-muted-foreground">
                Google Maps → Share → Embed a map. Paste either the link or the whole
                &lt;iframe&gt; snippet.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Opening hours</CardTitle>
              <CardDescription>Displayed in the footer and contact page.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addHoursRow}>
              <Plus className="size-4" />
              Add row
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <FieldError id="businessHours-error" message={errors.businessHours} />
            {settings.businessHours.map((item, index) => (
              <div
                // Key must not depend on the edited text — a changing key remounts
                // the row on every keystroke and the input loses focus.
                key={index}
                className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                {/* Marked per row: the section-level message says a row is
                    blank, and with seven rows the admin should not have to
                    hunt for which one while Save is disabled. */}
                <Input
                  value={item.day}
                  aria-invalid={!item.day.trim()}
                  aria-label={`Day, row ${index + 1}`}
                  className={cn(!item.day.trim() && "border-destructive")}
                  onChange={(e) => updateHours(index, { day: e.target.value })}
                  placeholder="Day"
                />
                <Input
                  value={item.hours}
                  aria-invalid={!item.hours.trim()}
                  aria-label={`Hours, row ${index + 1}`}
                  className={cn(!item.hours.trim() && "border-destructive")}
                  onChange={(e) => updateHours(index, { hours: e.target.value })}
                  placeholder="Hours"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeHoursRow(index)}
                  disabled={settings.businessHours.length <= 1}
                  aria-label="Remove hours row"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </SettingsSectionShell>
  );
}
