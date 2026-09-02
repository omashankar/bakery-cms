"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  reportSettingsReset,
  reportSettingsWrite,
} from "@/apps/admin/settings/lib/report-settings-write";
import { AdminSelect, adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhotoField } from "@/apps/admin/media/components/photo-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { GeneralSettings, LabelOverrides } from "@/types/settings";
import { describeWordingProblems, guessPlural } from "@/config/business-labels";
import {
  currencyOptions,
  defaultGeneralSettings,
  isSafeAssetUrl,
  timezoneOptions,
} from "@/features/settings/lib/settings-utils";
import {
  getGeneralSettings,
  getLabelSettings,
  resetGeneralSettings,
  saveGeneralSettings,
  saveLabelSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { useSettingsSection } from "@/features/settings/lib/use-settings-section";
import { useBusinessLabels } from "@/hooks/use-business-labels";
import { SettingsSectionShell } from "./settings-section-shell";
import { FieldError, SettingsHydrationNotice } from "./settings-field-error";

/**
 * Everything the server will reject, checked here first.
 *
 * Without this the only feedback for an empty site name was a round-trip 422
 * surfaced as "saved on this device only — the server rejected it", which reads
 * like an outage rather than "you cleared a required field".
 */
function validate(settings: GeneralSettings) {
  const assetHint = "Use a path like /images/logo.svg or a full https:// URL.";
  return {
    siteName: settings.siteName.trim()
      ? ""
      : "Site name is required — it is the store name in the navbar, the browser tab and every email.",
    logo: isSafeAssetUrl(settings.logo) ? "" : assetHint,
    favicon: isSafeAssetUrl(settings.favicon) ? "" : assetHint,
  };
}

export function GeneralSettingsPage() {
  const router = useRouter();
  const { settings, isDirty, hydration, isWriting, canSave, edit, discard, runWrite } =
    useSettingsSection<GeneralSettings>(getGeneralSettings, defaultGeneralSettings);

  const errors = validate(settings);
  const hasErrors = Object.values(errors).some(Boolean);
  /** The wording in force right now — used as the placeholder for each box. */
  const labels = useBusinessLabels();

  /**
   * The site name in the tab, the favicon, and the currency and timezone every
   * formatter uses are all read by the ROOT layout on the server. Nothing here
   * re-runs that, so without this the admin saves a new currency and keeps
   * seeing prices in the old one until they reload by hand.
   */
  function refreshServerRender() {
    router.refresh();
  }

  /**
   * The shop's own word for what it sells.
   *
   * Held beside the section rather than inside it because it is a different
   * settings section on the server (`labelOverrides`), and saved in the same
   * click because an owner does not think of "what do you call your products"
   * as a separate screen. Seeded after mount: `getLabelSettings` reads
   * localStorage, which the server cannot.
   */
  const [wording, setWording] = useState<LabelOverrides>({});
  const [wordingDirty, setWordingDirty] = useState(false);
  /**
   * Whether the plural box is the shop’s OWN answer rather than a guess.
   *
   * The same rule the product form uses for slug-follows-name: derive until
   * somebody types in the box themselves, then never touch it again. Seeded
   * true whenever a plural is already stored, so an existing answer — a shop
   * that wrote “Mithai” for both — is never overwritten by an English rule.
   */
  const [pluralTouched, setPluralTouched] = useState(false);
  useEffect(() => {
    const sync = () => {
      const stored = getLabelSettings();
      setWording(stored);
      if (stored.productWordPlural?.trim()) setPluralTouched(true);
    };
    sync();
    window.addEventListener(SETTINGS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, sync);
  }, []);

  function editWording(patch: Partial<LabelOverrides>) {
    setWording((prev) => ({ ...prev, ...patch }));
    setWordingDirty(true);
  }

  /**
   * One word typed, two boxes filled.
   *
   * Both were blank and independent, so an owner had to fill each and could
   * fill them the same — this shop put “products” in both, and every plural
   * surface then read “Add products”. The guess is only ever a starting value;
   * the box below stays editable because these are English rules and a shop
   * selling Mithai is right and they are not.
   */
  function editProductWord(value: string) {
    editWording({
      productWord: value,
      ...(pluralTouched ? {} : { productWordPlural: guessPlural(value) }),
    });
  }

  const wordingProblems = describeWordingProblems(wording);

  async function handleSave() {
    if (hasErrors || !canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await saveGeneralSettings(settings);
      // Only mark clean when the SERVER has it — the dirty flag is what keeps
      // the Save button enabled, and greying it out removes the only retry.
      const accepted = reportSettingsWrite(persisted, "General settings");
      if (accepted) refreshServerRender();
      return { value, accepted };
    });

    if (wordingDirty) {
      const { persisted } = await saveLabelSettings(wording);
      if (reportSettingsWrite(persisted, "Product wording")) {
        setWordingDirty(false);
        refreshServerRender();
      }
    }
  }

  function handleDiscard() {
    discard();
    toast.message("Discarded unsaved changes");
  }

  async function handleReset() {
    if (!canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await resetGeneralSettings();
      const accepted = reportSettingsReset(persisted, "General settings");
      if (accepted) refreshServerRender();
      return { value, accepted };
    });
  }

  return (
    <SettingsSectionShell
      title="General"
      description={
        hydration === "ready"
          ? `${settings.siteName} · ${labels.productWordPlural} · ${settings.currency}`
          : "Site identity, product wording, branding, timezone, and currency."
      }
      isDirty={isDirty || wordingDirty}
      // Behind the skeleton until the SERVER's copy has landed: editing the seed
      // makes the form dirty, the resync then skips it to protect the edit, and
      // Save pushes the seeded name/INR/Asia-Kolkata over the shop's own identity.
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
            <CardTitle className="text-base">Site identity</CardTitle>
            <CardDescription>Shown in the navbar, footer, and browser title.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="siteName">Site name</Label>
              <Input
                id="siteName"
                value={settings.siteName}
                aria-invalid={Boolean(errors.siteName)}
                aria-describedby={errors.siteName ? "siteName-error" : undefined}
                className={cn(errors.siteName && "border-destructive")}
                onChange={(e) => edit((prev) => ({ ...prev, siteName: e.target.value }))}
              />
              <FieldError id="siteName-error" message={errors.siteName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteTagline">Tagline</Label>
              <Input
                id="siteTagline"
                value={settings.siteTagline}
                onChange={(e) => edit((prev) => ({ ...prev, siteTagline: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteDescription">Description</Label>
              <textarea
                id="siteDescription"
                className={adminTextareaClassName}
                value={settings.siteDescription}
                onChange={(e) =>
                  edit((prev) => ({ ...prev, siteDescription: e.target.value }))
                }
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Branding &amp; locale</CardTitle>
            <CardDescription>What you call your products, logo paths, and regional defaults.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/*
              A "Business type" select sat here — ten trades, one of which every
              shop had to be. It restricted nothing (audited: the only thing it
              gated was the Wedding Builder), it had to grow a row every time a
              shop was a trade nobody had listed, and a shop selling cakes AND
              chargers AND flowers had no honest answer to give it.

              What it really did is now said directly: the two boxes below name
              what this shop sells, and Settings → Modules turns the Wedding
              Builder on.

              `labelOverrides` has existed on the server for as long as business
              types have — `resolveLabels` layers it over the default — and
              nothing read it, so a flower shop that wanted "Bouquet" was told
              "Cake" whatever it typed, because there was nowhere to type it.
            */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="productWord">What do you call one product?</Label>
                <Input
                  id="productWord"
                  value={wording.productWord ?? ""}
                  aria-describedby={wordingProblems.productWord ? "productWord-hint" : undefined}
                  onChange={(e) => editProductWord(e.target.value)}
                  placeholder={labels.productWord}
                />
                {wordingProblems.productWord ? (
                  <p id="productWord-hint" className="text-xs text-amber-700">
                    {wordingProblems.productWord}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="productWordPlural">
                  And more than one?{" "}
                  {pluralTouched ? null : (
                    <span className="font-normal text-muted-foreground">— filled in for you</span>
                  )}
                </Label>
                <Input
                  id="productWordPlural"
                  value={wording.productWordPlural ?? ""}
                  aria-describedby={
                    wordingProblems.productWordPlural ? "productWordPlural-hint" : undefined
                  }
                  onChange={(e) => {
                    // From here on this box is the shop’s own answer, and the
                    // English guess must never overwrite it again.
                    setPluralTouched(true);
                    editWording({ productWordPlural: e.target.value });
                  }}
                  placeholder={labels.productWordPlural}
                />
                {wordingProblems.productWordPlural ? (
                  <p id="productWordPlural-hint" className="text-xs text-amber-700">
                    {wordingProblems.productWordPlural}
                  </p>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                Used across the admin and your storefront — &ldquo;Add {labels.productWord}
                &rdquo;, &ldquo;Search {labels.productWordPlural.toLowerCase()}&rdquo;.
                {" "}
                <strong className="font-medium">Leave both blank</strong> if you sell more
                than one kind of thing — the default wording is the honest one for a
                mixed catalogue.
              </p>

              {/*
                These two were the half that had no input.
                `labelOverrides` has always carried four fields — the type, the
                Zod schema, the merge and the hydrate all handle them — and only
                the product nouns were editable. So the shop-all page's heading
                and subtitle could be CHANGED by removing the business-type
                presets and not changed back from anywhere in the product.
              */}
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="collectionsTitle">Heading on your shop-all page</Label>
                <Input
                  id="collectionsTitle"
                  value={wording.collectionsTitle ?? ""}
                  onChange={(e) => editWording({ collectionsTitle: e.target.value })}
                  placeholder={labels.collectionsTitle}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="collectionsSubtitle">The line under it</Label>
                <Input
                  id="collectionsSubtitle"
                  value={wording.collectionsSubtitle ?? ""}
                  onChange={(e) => editWording({ collectionsSubtitle: e.target.value })}
                  placeholder={labels.collectionsSubtitle}
                />
              </div>
            </div>
            {/*
              * These two were bare URL boxes with no picker of any kind, which
              * made the shop's own logo and favicon the HARDEST images in the
              * admin to set — you had to host the file somewhere yourself and
              * type its address. They are square because a mark is.
              */}
            <div className="space-y-2">
              <PhotoField
                id="logo"
                label="Logo"
                aspect="square"
                value={settings.logo}
                onChange={(url) => edit((prev) => ({ ...prev, logo: url }))}
                placeholder="/images/logo.svg"
                error={errors.logo}
              />
              <p className="text-xs text-muted-foreground">
                Shown as the storefront mark. Leave empty to use the header&apos;s letter mark.
              </p>
            </div>
            <PhotoField
              id="favicon"
              label="Favicon"
              aspect="square"
              value={settings.favicon}
              onChange={(url) => edit((prev) => ({ ...prev, favicon: url }))}
              placeholder="/favicon.ico"
              error={errors.favicon}
            />
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <AdminSelect
                id="timezone"
                value={settings.timezone}
                onChange={(e) => edit((prev) => ({ ...prev, timezone: e.target.value }))}
              >
                {timezoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AdminSelect>
              <p className="text-xs text-muted-foreground">
                Dates and times across the admin and storefront are rendered in this zone.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <AdminSelect
                id="currency"
                value={settings.currency}
                onChange={(e) => edit((prev) => ({ ...prev, currency: e.target.value }))}
              >
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AdminSelect>
              <p className="text-xs text-muted-foreground">
                Every price shown in the admin and the storefront is formatted in this currency.
                It does not convert existing amounts.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsSectionShell>
  );
}
