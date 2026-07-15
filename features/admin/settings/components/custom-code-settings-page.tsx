"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Code2, Info, Save } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader } from "@/features/admin/components";
import { adminTextareaClassName } from "@/features/admin/cakes/components/admin-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";

const STORAGE_KEY = "bakery-cms-custom-code";

interface CustomCode {
  css: string;
  js: string;
}

export function CustomCodeSettingsPage() {
  const [code, setCode] = useState<CustomCode>({ css: "", js: "" });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setCode(JSON.parse(raw) as CustomCode);
    } catch {
      // ignore
    }
    setMounted(true);
  }, []);

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(code));
    toast.success("Custom code saved", {
      description: "It will be injected into the storefront once the backend is connected.",
    });
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Custom Code"
        description="Inject custom CSS and JavaScript into the storefront."
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Button variant="outline" render={<Link href={routes.admin.settings.overview} />}>
              <ArrowLeft className="size-4" />
              All settings
            </Button>
            <Button variant="bakery" onClick={handleSave} disabled={!mounted}>
              <Save className="size-4" />
              Save code
            </Button>
          </div>
        }
      />

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
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
          <Label htmlFor="custom-css" className="sr-only">Custom CSS</Label>
          <textarea
            id="custom-css"
            className={`${adminTextareaClassName} font-mono text-xs`}
            rows={10}
            placeholder={"/* .storefront-navbar { border-bottom: 1px solid #eee; } */"}
            value={code.css}
            onChange={(e) => setCode((c) => ({ ...c, css: e.target.value }))}
            disabled={!mounted}
            spellCheck={false}
          />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <Code2 className="size-4 text-bakery-700" />
          <CardTitle className="text-base">Custom JavaScript</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="custom-js" className="sr-only">Custom JavaScript</Label>
          <textarea
            id="custom-js"
            className={`${adminTextareaClassName} font-mono text-xs`}
            rows={10}
            placeholder={"// console.log('Loaded custom script');"}
            value={code.js}
            onChange={(e) => setCode((c) => ({ ...c, js: e.target.value }))}
            disabled={!mounted}
            spellCheck={false}
          />
        </CardContent>
      </Card>
    </AdminPage>
  );
}
