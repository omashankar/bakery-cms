"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import type { BusinessHoursEntry, ContactSettings } from "@/types/settings";
import { defaultContactSettings } from "@/features/settings/lib/settings-utils";
import {
  getContactSettings,
  resetContactSettings,
  saveContactSettings,
} from "@/features/settings/lib/settings-repository";
import { SettingsSectionShell } from "./settings-section-shell";

export function ContactSettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<ContactSettings>(defaultContactSettings);
  const [savedSettings, setSavedSettings] = useState<ContactSettings>(defaultContactSettings);

  useEffect(() => {
    const loaded = getContactSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    setMounted(true);
  }, []);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const emailSet = Boolean(settings.email.trim());
  const hoursCount = settings.businessHours.length;

  function updateHours(index: number, patch: Partial<BusinessHoursEntry>) {
    setSettings((prev) => ({
      ...prev,
      businessHours: prev.businessHours.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      ),
    }));
  }

  function addHoursRow() {
    setSettings((prev) => ({
      ...prev,
      businessHours: [...prev.businessHours, { day: "New day", hours: "9:00 AM – 5:00 PM" }],
    }));
  }

  function removeHoursRow(index: number) {
    setSettings((prev) => ({
      ...prev,
      businessHours: prev.businessHours.filter((_, i) => i !== index),
    }));
  }

  function handleSave() {
    const saved = saveContactSettings(settings);
    setSavedSettings(saved);
    setSettings(saved);
    toast.success("Contact settings saved");
  }

  function handleDiscard() {
    setSettings(savedSettings);
    toast.message("Discarded unsaved changes");
  }

  function handleReset() {
    const loaded = resetContactSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    toast.success("Contact settings reset to defaults");
  }

  return (
    <SettingsSectionShell
      title="Contact"
      description={
        mounted
          ? `${emailSet ? settings.email : "No email"} · ${hoursCount} hour row${hoursCount === 1 ? "" : "s"}`
          : "Business contact details shown on the contact page and footer."
      }
      isDirty={isDirty}
      mounted={mounted}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
    >
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
                onChange={(e) => setSettings((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={settings.phone}
                onChange={(e) => setSettings((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <textarea
                id="address"
                className={adminTextareaClassName}
                value={settings.address}
                onChange={(e) => setSettings((prev) => ({ ...prev, address: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mapEmbedUrl">Google Maps embed URL</Label>
              <textarea
                id="mapEmbedUrl"
                className={adminTextareaClassName}
                value={settings.mapEmbedUrl ?? ""}
                onChange={(e) => setSettings((prev) => ({ ...prev, mapEmbedUrl: e.target.value }))}
                rows={3}
              />
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
            {settings.businessHours.map((item, index) => (
              <div
                // Key must not depend on the edited text — a changing key remounts
                // the row on every keystroke and the input loses focus.
                key={index}
                className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <Input
                  value={item.day}
                  onChange={(e) => updateHours(index, { day: e.target.value })}
                  placeholder="Day"
                />
                <Input
                  value={item.hours}
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
