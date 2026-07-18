"use client";

import Link from "next/link";
import { ExternalLink, History, RotateCcw, Save, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/constants/routes";
import { adminShell } from "@/apps/admin/components/admin-shell";
import { cn } from "@/lib/utils";

interface BuilderToolbarProps {
  title: string;
  description: string;
  isDirty?: boolean;
  isSaving?: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
  onReset?: () => void;
  onDiscard?: () => void;
  onPreview?: () => void;
  onOpenHistory?: () => void;
  previewHref?: string;
  scheduledPublishAt?: string;
  onScheduleChange?: (value: string) => void;
  meta?: {
    sectionCount?: number;
    visibleCount?: number;
    publishedAt?: string | null;
    hasUnpublishedChanges?: boolean;
    scheduledPublishAt?: string | null;
  };
}

export function BuilderToolbar({
  title,
  description,
  isDirty,
  isSaving,
  onSaveDraft,
  onPublish,
  onReset,
  onDiscard,
  onPreview,
  onOpenHistory,
  previewHref = `${routes.store.home}?cmsPreview=1`,
  scheduledPublishAt,
  onScheduleChange,
  meta,
}: BuilderToolbarProps) {
  return (
    <div
      className={cn(
        "shrink-0 space-y-3 border-b border-border bg-card",
        // Match the vertical + horizontal insets of standard admin pages so the
        // builder title lines up exactly with every other page's AdminPageHeader.
        adminShell.mainPadding,
        adminShell.contentWrap
      )}
    >
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
              {title}
            </h1>
            {isDirty ? <Badge variant="warning">Unsaved</Badge> : null}
            {!isDirty && meta?.hasUnpublishedChanges ? (
              <Badge variant="outline">Unpublished</Badge>
            ) : null}
            {meta?.scheduledPublishAt ? (
              <Badge variant="accent">Scheduled</Badge>
            ) : null}
            {!isDirty && !meta?.hasUnpublishedChanges && meta?.publishedAt ? (
              <span className="text-xs text-muted-foreground">
                Published {new Date(meta.publishedAt).toLocaleString()}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:items-stretch xl:max-w-xl xl:items-end">
          <div className="flex min-w-0 gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
            {onReset ? (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 text-muted-foreground"
                onClick={onReset}
              >
                <RotateCcw className="size-4" />
                <span className="hidden sm:inline">Reset</span>
              </Button>
            ) : null}
            {onOpenHistory ? (
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={onOpenHistory}
              >
                <History className="size-4" />
                <span className="hidden sm:inline">History</span>
              </Button>
            ) : null}
            {onPreview ? (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={onPreview}
              >
                <ExternalLink className="size-4" />
                Preview
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                render={
                  <Link href={previewHref} target="_blank" rel="noopener noreferrer" />
                }
              >
                <ExternalLink className="size-4" />
                Preview
              </Button>
            )}
            {isDirty && onDiscard ? (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={onDiscard}
                disabled={isSaving}
              >
                Discard
              </Button>
            ) : null}
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="min-w-0"
              onClick={onSaveDraft}
              disabled={isSaving || !isDirty}
            >
              <Save className="size-4" />
              Save draft
            </Button>
            <Button
              variant="bakery"
              size="sm"
              className="min-w-0"
              onClick={onPublish}
              disabled={isSaving}
            >
              <Upload className="size-4" />
              Publish
            </Button>
          </div>
        </div>
      </div>

      {onScheduleChange ? (
        <div className="flex min-w-0 flex-wrap items-end gap-2 border-t border-border pt-3">
          <div className="min-w-0 flex-1 space-y-1 sm:flex-none">
            <Label htmlFor="builder-schedule" className="text-xs text-muted-foreground">
              Schedule publish
            </Label>
            <Input
              id="builder-schedule"
              type="datetime-local"
              className="h-9 w-full min-w-0 max-w-full sm:w-52"
              value={scheduledPublishAt ?? ""}
              onChange={(event) => onScheduleChange(event.target.value)}
            />
          </div>
          {scheduledPublishAt ? (
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-muted-foreground"
              onClick={() => onScheduleChange("")}
            >
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
