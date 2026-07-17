"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Code2, Info } from "lucide-react";
import { toast } from "sonner";
import { adminShell } from "@/features/admin/components";
import { adminTextareaClassName } from "@/features/admin/cakes/components/admin-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { routes } from "@/constants/routes";
import { SettingsSectionShell } from "./settings-section-shell";

const STORAGE_KEY = "bakery-cms-custom-code";

interface CustomCode {
  css: string;
  js: string;
}

const EMPTY_CODE: CustomCode = { css: "", js: "" };

function countLines(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split("\n").length : 0;
}

export function CustomCodeSettingsPage() {
  const [code, setCode] = useState<CustomCode>(EMPTY_CODE);
  const [savedCode, setSavedCode] = useState<CustomCode>(EMPTY_CODE);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const loaded = JSON.parse(raw) as CustomCode;
        setCode(loaded);
        setSavedCode(loaded);
      }
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  const isDirty = JSON.stringify(code) !== JSON.stringify(savedCode);

  /** Returns false when the browser refuses the write (quota, private mode). */
  function persist(next: CustomCode): boolean {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch {
      toast.error("Could not save — browser storage is full or unavailable");
      return false;
    }
  }

  function handleSave() {
    if (!persist(code)) return;
    setSavedCode(code);
    toast.success("Custom code saved", {
      description: "It will be injected into the storefront once the backend is connected.",
    });
  }

  function handleDiscard() {
    setCode(savedCode);
    toast.message("Discarded unsaved changes");
  }

  function handleReset() {
    if (!persist(EMPTY_CODE)) return;
    setCode(EMPTY_CODE);
    setSavedCode(EMPTY_CODE);
    toast.success("Custom code cleared");
  }

  return (
    <SettingsSectionShell
      title="Custom Code"
      description={
        mounted
          ? `${countLines(code.css)} CSS lines · ${countLines(code.js)} JS lines`
          : "Inject custom CSS and JavaScript into the storefront."
      }
      isDirty={isDirty}
      mounted={mounted}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
      saveLabel="Save code"
      resetTitle="Clear custom code?"
      resetDescription="Remove all custom CSS and JavaScript. The storefront returns to its default styling."
      extraActions={
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          render={<Link href={routes.admin.settings.overview} />}
        >
          <ArrowLeft className="size-4" />
          All settings
        </Button>
      }
    >
      <div
        className={cn(
          "flex items-start gap-2 rounded-xl border p-4 text-sm",
          adminShell.alertWarning
        )}
      >
        <Info className="mt-0.5 size-4 shrink-0" />
        <p>
          Advanced. Invalid code can break your storefront. It is stored now and applied when the
          backend renders it.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Code2 className="size-4 text-bakery-700" />
          <CardTitle className="text-base">Custom CSS</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="custom-css" className="sr-only">
            Custom CSS
          </Label>
          <textarea
            id="custom-css"
            className={`${adminTextareaClassName} font-mono text-xs`}
            rows={10}
            placeholder={"/* .storefront-navbar { border-bottom: 1px solid #eee; } */"}
            value={code.css}
            onChange={(e) => setCode((c) => ({ ...c, css: e.target.value }))}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Code2 className="size-4 text-bakery-700" />
          <CardTitle className="text-base">Custom JavaScript</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="custom-js" className="sr-only">
            Custom JavaScript
          </Label>
          <textarea
            id="custom-js"
            className={`${adminTextareaClassName} font-mono text-xs`}
            rows={10}
            placeholder={"// console.log('Loaded custom script');"}
            value={code.js}
            onChange={(e) => setCode((c) => ({ ...c, js: e.target.value }))}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </CardContent>
      </Card>
    </SettingsSectionShell>
  );
}
