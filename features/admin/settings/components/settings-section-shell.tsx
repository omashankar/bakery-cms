"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AdminMobileActionBar, AdminPage, AdminPageHeader } from "@/features/admin/components";

interface SettingsSectionShellProps {
  title: string;
  description: string;
  isDirty: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onReset: () => void;
  children: React.ReactNode;
  extraActions?: React.ReactNode;
  mounted?: boolean;
  resetTitle?: string;
  resetDescription?: string;
}

/** Calm settings chrome: title, status line, Reset / Discard / Save — no KPI farm. */
export function SettingsSectionShell({
  title,
  description,
  isDirty,
  onSave,
  onDiscard,
  onReset,
  children,
  extraActions,
  mounted = true,
  resetTitle = "Reset to defaults?",
  resetDescription = "Replace this section with the demo defaults. Other settings sections are not changed.",
}: SettingsSectionShellProps) {
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  function confirmReset() {
    onReset();
    setResetOpen(false);
  }

  return (
    <AdminPage className={cn("space-y-4 sm:space-y-5", isDirty && "pb-20 md:pb-0")}>
      <AdminPageHeader
        title={title}
        description={description}
        className="gap-3"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            {extraActions}
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw className="size-4" />
              Reset
            </Button>
            {isDirty ? (
              <Button variant="outline" className="hidden sm:inline-flex" onClick={onDiscard}>
                Discard
              </Button>
            ) : null}
            <Button
              variant="bakery"
              className="hidden sm:inline-flex"
              onClick={onSave}
              disabled={!isDirty}
            >
              <Save className="size-4" />
              Save changes
            </Button>
          </div>
        }
      />

      {!mounted ? (
        <div className="min-h-48 animate-pulse rounded-xl border border-border bg-muted" />
      ) : (
        children
      )}

      {isDirty ? (
        <AdminMobileActionBar className="md:hidden">
          <Button variant="outline" className="flex-1" onClick={onDiscard}>
            Discard
          </Button>
          <Button variant="bakery" className="flex-1" onClick={onSave}>
            <Save className="size-4" />
            Save
          </Button>
        </AdminMobileActionBar>
      ) : null}

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{resetTitle}</DialogTitle>
            <DialogDescription>{resetDescription}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReset}>
              Reset defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
