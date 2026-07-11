"use client";

import Link from "next/link";
import { Cake, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import type { AppearanceSettings } from "@/types/appearance";
import {
  defaultAppearanceSettings,
  isValidHexColor,
  normalizeHexColor,
} from "../lib/appearance-utils";

interface AppearancePreviewProps {
  settings: AppearanceSettings;
  isDirty?: boolean;
}

function previewColor(
  value: string,
  fallback: string
): string {
  return isValidHexColor(value) ? normalizeHexColor(value) : fallback;
}

export function AppearancePreview({ settings, isDirty = false }: AppearancePreviewProps) {
  const primary = previewColor(settings.primaryColor, defaultAppearanceSettings.primaryColor);
  const accent = previewColor(settings.accentColor, defaultAppearanceSettings.accentColor);
  const surface = previewColor(settings.surfaceColor, defaultAppearanceSettings.surfaceColor);
  const radius = settings.borderRadius === 16 ? 16 : 12;

  const previewStyle = {
    "--preview-primary": primary,
    "--preview-accent": accent,
    "--preview-surface": surface,
    "--preview-radius": `${radius}px`,
  } as React.CSSProperties;

  return (
    <Card className="overflow-hidden shadow-sm" style={previewStyle}>
      <CardHeader className="border-b border-border bg-[var(--preview-surface)]">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Storefront preview</CardTitle>
          {isDirty ? (
            <Badge variant="warning">Unsaved</Badge>
          ) : (
            <Badge variant="outline">Saved</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-0">
        <div className="border-b border-border bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div
                className="flex size-8 shrink-0 items-center justify-center rounded-[var(--preview-radius)] text-sm font-bold text-white"
                style={{ backgroundColor: "var(--preview-primary)" }}
              >
                M
              </div>
              <span className="truncate font-heading text-sm font-bold">Monginis</span>
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

        <div className="space-y-4 px-4 pb-4">
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
                ₹1,299
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[var(--preview-radius)] border border-border bg-white p-3">
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
            <div className="rounded-[var(--preview-radius)] border border-border bg-white p-3">
              <Search className="mb-2 size-5 text-[var(--preview-accent)]" />
              <p className="text-sm font-medium">Accent</p>
              <div
                className="mt-2 h-9 rounded-[var(--preview-radius)] border-2 bg-white"
                style={{ borderColor: "var(--preview-accent)" }}
              />
            </div>
          </div>

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
