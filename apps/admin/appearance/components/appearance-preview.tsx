"use client";

import Link from "next/link";
import { Cake, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import type { AppearanceSettings } from "@/types/appearance";
import type { FormHydration } from "@/features/settings/lib/use-hydrated-form";
import { getGeneralSettings } from "@/features/settings/lib/settings-repository";
import { loadHeaderSettings } from "@/features/site-layout/lib/header-repository";
import { formatCurrency } from "@/utils/format";
import {
  defaultAppearanceSettings,
  isValidHexColor,
  normalizeHexColor,
} from "@/features/site-layout/lib/appearance-utils";

interface AppearancePreviewProps {
  settings: AppearanceSettings;
  isDirty?: boolean;
  /**
   * Whether this page has heard from the server.
   *
   * "Saved" is a claim ABOUT the server, so it may only be made once one has
   * answered. On a failed read the form holds the demo seed and `isDirty` is
   * false, which put an outline "Saved" badge inches below a notice saying the
   * settings could not be loaded.
   */
  hydration?: FormHydration;
  /**
   * The last palette the server confirmed, used while a colour is mid-typing.
   *
   * Falling back to the DEMO defaults meant that deleting a character from
   * `#6f4e37` flipped the whole preview to the demo brown, while the admin
   * chrome around it kept the last valid palette — the two panels disagreeing
   * about the same shop for as long as the field was invalid.
   */
  saved?: AppearanceSettings;
}

function previewColor(
  value: string,
  fallback: string
): string {
  return isValidHexColor(value) ? normalizeHexColor(value) : fallback;
}

export function AppearancePreview({
  settings,
  isDirty = false,
  hydration = "ready",
  saved,
}: AppearancePreviewProps) {
  // The saved palette first, the demo default only if there is no saved one —
  // matching what `appearance-page.tsx` does when it live-applies.
  const base = saved ?? defaultAppearanceSettings;
  const primary = previewColor(settings.primaryColor, base.primaryColor);
  const accent = previewColor(settings.accentColor, base.accentColor);
  const surface = previewColor(settings.surfaceColor, base.surfaceColor);
  const radius = settings.borderRadius === 16 ? 16 : 12;

  /**
   * The shop's OWN name, letter and currency.
   *
   * These were hardcoded to a fixed letter, a fixed shop name and "₹1,299" —
   * the demo brand's identity rather than this shop's, in the one panel whose
   * entire job is to show this shop what its storefront looks like. The live navbar renders `chrome.logoLetter` and
   * `chrome.siteName`, and prices use the configured currency, so the preview
   * was demonstrating a storefront nobody has.
   *
   * Read from the same client stores the rest of the admin uses. Both fall
   * back to their own defaults, so a cold cache shows something sensible
   * rather than an empty navbar.
   */
  const general = getGeneralSettings();
  const header = loadHeaderSettings();
  const siteName = general.siteName?.trim() || "Your bakery";
  const logoLetter = header.logoLetter?.trim() || siteName.charAt(0).toUpperCase();
  const samplePrice = formatCurrency(1299, general.currency);

  const previewStyle = {
    "--preview-primary": primary,
    "--preview-accent": accent,
    "--preview-surface": surface,
    "--preview-radius": `${radius}px`,
  } as React.CSSProperties;

  return (
    <Card className="overflow-hidden shadow-sm" style={previewStyle}>
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Storefront preview</CardTitle>
          {/*
            "Saved" is a claim about the SERVER, so it may only be made when
            this page has heard from it. On an unavailable read the form holds
            the demo seed and `isDirty` is false, which put an outline
            "Saved" badge inches below a notice saying the settings could not
            be loaded.
          */}
          {hydration !== "ready" ? (
            <Badge variant="outline">Not loaded</Badge>
          ) : isDirty ? (
            <Badge variant="warning">Unsaved</Badge>
          ) : (
            <Badge variant="outline">Saved</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-0">
        {/* Light island — the storefront is light-only, so it must not inherit admin dark tokens. */}
        <div
          className="storefront-light bg-background text-foreground"
          data-storefront-theme="light"
          style={{ colorScheme: "light" }}
        >
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className="flex size-8 shrink-0 items-center justify-center rounded-[var(--preview-radius)] text-sm font-bold text-white"
                  style={{ backgroundColor: "var(--preview-primary)" }}
                >
                  {logoLetter}
                </div>
                <span className="truncate font-heading text-sm font-bold">{siteName}</span>
              </div>
              <Button
                size="sm"
                className="shrink-0 text-white"
                style={{
                  backgroundColor: "var(--preview-primary)",
                  borderRadius: "var(--preview-radius)",
                }}
              >
                Order
              </Button>
            </div>
          </div>

          <div className="space-y-4 px-4 py-4">
            <div
              className="rounded-[var(--preview-radius)] border border-border p-4"
              style={{ backgroundColor: "var(--preview-surface)" }}
            >
              <p className="text-xs font-semibold tracking-widest text-[var(--preview-primary)] uppercase">
                Featured Cake
              </p>
              <h3 className="mt-2 font-heading text-xl font-bold">Chocolate Truffle</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Rich Belgian chocolate layers with silky ganache.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  style={{
                    borderColor: "var(--preview-accent)",
                    color: "var(--preview-primary)",
                  }}
                >
                  Bestseller
                </Badge>
                <span className="text-sm font-semibold text-[var(--preview-primary)]">
                  {samplePrice}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[var(--preview-radius)] border border-border bg-background p-3">
                <Cake className="mb-2 size-5 text-[var(--preview-primary)]" />
                <p className="text-sm font-medium">Primary</p>
                <Button
                  size="sm"
                  className="mt-2 w-full text-white"
                  style={{
                    backgroundColor: "var(--preview-primary)",
                    borderRadius: "var(--preview-radius)",
                  }}
                >
                  Add Cake
                </Button>
              </div>
              <div className="rounded-[var(--preview-radius)] border border-border bg-background p-3">
                <Search className="mb-2 size-5 text-[var(--preview-accent)]" />
                <p className="text-sm font-medium">Accent</p>
                <div
                  className="mt-2 h-9 rounded-[var(--preview-radius)] border-2 bg-background"
                  style={{ borderColor: "var(--preview-accent)" }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-4 pb-4">
          {isDirty ? (
            <p className="text-center text-xs text-amber-700 dark:text-amber-400">
              Light storefront preview — updates locally until you save.
            </p>
          ) : null}

          <Button
            variant="outline"
            className="w-full"
            render={<Link href={routes.store.home} target="_blank" />}
          >
            Open storefront
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
