"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { AdminSelect, adminTextareaClassName } from "@/features/admin/cakes/components/admin-field";
import { CakeMediaPicker } from "@/features/admin/cakes/components/cake-media-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GlobalSeoSettings, SeoRouteEntry } from "@/types/seo";
import { updateSeoRoute } from "../lib/seo-repository";
import {
  DESCRIPTION_IDEAL_MAX,
  TITLE_IDEAL_MAX,
  charCountTone,
  countChars,
  parseKeywords,
} from "../lib/seo-metadata";
import { SeoSerpPreview } from "./seo-serp-preview";

interface SeoRouteEditDialogProps {
  open: boolean;
  entry: SeoRouteEntry | null;
  global: GlobalSeoSettings;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

type SeoRouteFormState = {
  metaTitle: string;
  metaDescription: string;
  keywords: string;
  ogImage: string;
  noIndex: boolean;
  noFollow: boolean;
  twitterCard: "summary" | "summary_large_image";
};

function serializeForm(form: SeoRouteFormState): string {
  return JSON.stringify(form);
}

export function SeoRouteEditDialog({
  open,
  entry,
  global,
  onOpenChange,
  onSaved,
}: SeoRouteEditDialogProps) {
  const [form, setForm] = useState<SeoRouteFormState>({
    metaTitle: "",
    metaDescription: "",
    keywords: "",
    ogImage: "",
    noIndex: false,
    noFollow: false,
    twitterCard: "summary_large_image",
  });
  const [baseline, setBaseline] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const isDirty = useMemo(
    () => Boolean(baseline) && serializeForm(form) !== baseline,
    [form, baseline]
  );

  useEffect(() => {
    if (!open) {
      setMediaOpen(false);
      setDiscardOpen(false);
      return;
    }
    if (!entry) return;

    const next: SeoRouteFormState = {
      metaTitle: entry.metaTitle,
      metaDescription: entry.metaDescription,
      keywords: (entry.metaKeywords ?? []).join(", "),
      ogImage: entry.ogImage ?? "",
      noIndex: entry.noIndex,
      noFollow: entry.noFollow ?? false,
      twitterCard: entry.twitterCard ?? global.defaultTwitterCard,
    };
    setForm(next);
    setBaseline(serializeForm(next));
  }, [open, entry, global.defaultTwitterCard]);

  function handleDiscard() {
    setForm(JSON.parse(baseline) as SeoRouteFormState);
    setDiscardOpen(false);
    toast.message("Discarded unsaved changes");
  }

  function requestClose() {
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(false);
  }

  function handleSave() {
    if (!entry) return;
    if (!form.metaTitle.trim() || !form.metaDescription.trim()) {
      toast.error("Title and description are required");
      return;
    }

    updateSeoRoute(entry.id, {
      metaTitle: form.metaTitle.trim(),
      metaDescription: form.metaDescription.trim(),
      metaKeywords: parseKeywords(form.keywords),
      ogImage: form.ogImage.trim() || undefined,
      noIndex: form.noIndex,
      noFollow: form.noFollow,
      twitterCard: form.twitterCard,
    });

    toast.success(`SEO updated for ${entry.label}`);
    onSaved();
    onOpenChange(false);
  }

  if (!entry) return null;

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            requestClose();
            return;
          }
          onOpenChange(true);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit SEO — {entry.label}</DialogTitle>
            <DialogDescription>
              {entry.path} · Meta tags used when this page is rendered on the public site.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="seo-title">Meta title</Label>
                  <span
                    className={`text-xs ${charCountTone(
                      countChars(form.metaTitle),
                      TITLE_IDEAL_MAX
                    )}`}
                  >
                    {countChars(form.metaTitle)}/{TITLE_IDEAL_MAX}
                  </span>
                </div>
                <Input
                  id="seo-title"
                  value={form.metaTitle}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, metaTitle: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="seo-description">Meta description</Label>
                  <span
                    className={`text-xs ${charCountTone(
                      countChars(form.metaDescription),
                      DESCRIPTION_IDEAL_MAX
                    )}`}
                  >
                    {countChars(form.metaDescription)}/{DESCRIPTION_IDEAL_MAX}
                  </span>
                </div>
                <textarea
                  id="seo-description"
                  className={adminTextareaClassName}
                  value={form.metaDescription}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, metaDescription: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="seo-keywords">Keywords</Label>
                <Input
                  id="seo-keywords"
                  value={form.keywords}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, keywords: e.target.value }))
                  }
                  placeholder="cakes, bakery, wedding cakes"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="seo-og-image">Open Graph image</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setMediaOpen(true)}
                  >
                    <ImageIcon className="size-4" />
                    Media
                  </Button>
                </div>
                <Input
                  id="seo-og-image"
                  value={form.ogImage}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, ogImage: e.target.value }))
                  }
                  placeholder="https://… or pick from Media Library"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.noIndex}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, noIndex: checked === true }))
                  }
                />
                Hide from search engines (noindex)
              </label>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.noFollow}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, noFollow: checked === true }))
                  }
                />
                Do not follow links on this page (nofollow)
              </label>

              <div className="space-y-2">
                <Label htmlFor="seo-twitter-card">Twitter card type</Label>
                <AdminSelect
                  id="seo-twitter-card"
                  value={form.twitterCard}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      twitterCard: event.target.value as "summary" | "summary_large_image",
                    }))
                  }
                >
                  <option value="summary_large_image">Summary large image</option>
                  <option value="summary">Summary</option>
                </AdminSelect>
              </div>
            </div>

            <SeoSerpPreview
              global={global}
              entry={{
                path: entry.path,
                metaTitle: form.metaTitle,
                metaDescription: form.metaDescription,
              }}
              noIndex={form.noIndex}
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            {isDirty ? (
              <Button variant="outline" onClick={handleDiscard}>
                Discard
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            )}
            <Button variant="bakery" disabled={!isDirty} onClick={handleSave}>
              Save SEO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CakeMediaPicker
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        onSelect={(url) => {
          setForm((prev) => ({ ...prev, ogImage: url }));
          setMediaOpen(false);
        }}
      />

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              Unsaved SEO edits for this page will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDiscardOpen(false)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                handleDiscard();
                onOpenChange(false);
              }}
            >
              Discard & close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
