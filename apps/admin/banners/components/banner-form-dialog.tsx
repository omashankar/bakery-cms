"use client";

import { fromScheduleInputValue, toScheduleInputValue } from "@/lib/datetime-local";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { reportWrite } from "@/apps/admin/lib/report-write";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { PhotoField } from "@/apps/admin/media/components/photo-field";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import type { Banner } from "@/types/media";
import { createBanner, loadBanners, updateBanner } from "@/features/content/lib/banners-repository";
import { bannerPositionOptions, bannerVisibilityOptions } from "@/features/content/lib/banners-utils";

interface BannerFormDialogProps {
  open: boolean;
  bannerId?: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

type BannerFormState = {
  title: string;
  image: string;
  link: string;
  position: Banner["position"];
  visibility: Banner["visibility"];
  priority: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
};

const EMPTY_FORM: BannerFormState = {
  title: "",
  image: "",
  link: "",
  position: "hero",
  visibility: "all",
  priority: 0,
  startDate: "",
  endDate: "",
  isActive: true,
};

function serializeForm(form: BannerFormState): string {
  return JSON.stringify(form);
}

function bannerToForm(banner: Banner): BannerFormState {
  return {
    title: banner.title,
    image: banner.image,
    link: banner.link ?? "",
    position: banner.position,
    visibility: banner.visibility ?? "all",
    priority: banner.priority ?? 0,
    // The stored value is a UTC instant; this field is local wall time.
    //
    // Slicing the ISO string fed 03:30 into a datetime-local input for a
    // 09:00 IST start, so the field visibly jumped the moment the banner was
    // reopened — and the next save re-encoded that displayed value as local,
    // moving the real start another 5h30m earlier. Fixing a typo in the title
    // was enough to walk a Diwali banner backwards a day. Same bug, and the
    // same pair of helpers, as the builders' scheduled publish.
    startDate: toScheduleInputValue(banner.startDate),
    endDate: toScheduleInputValue(banner.endDate),
    isActive: banner.isActive,
  };
}

export function BannerFormDialog({
  open,
  bannerId,
  onOpenChange,
  onSaved,
}: BannerFormDialogProps) {
  const isEdit = Boolean(bannerId);
  const [form, setForm] = useState<BannerFormState>(EMPTY_FORM);
  const [baseline, setBaseline] = useState(serializeForm(EMPTY_FORM));
  const [discardOpen, setDiscardOpen] = useState(false);

  const isDirty = useMemo(() => serializeForm(form) !== baseline, [form, baseline]);

  useEffect(() => {
    if (!open) {
      setDiscardOpen(false);
      return;
    }

    if (!bannerId) {
      setForm(EMPTY_FORM);
      setBaseline(serializeForm(EMPTY_FORM));
      return;
    }

    const existing = loadBanners().find((item) => item.id === bannerId);
    if (existing) {
      const next = bannerToForm(existing);
      setForm(next);
      setBaseline(serializeForm(next));
    }
  }, [open, bannerId]);

  function patchForm(patch: Partial<BannerFormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleDiscard() {
    setForm(JSON.parse(baseline) as BannerFormState);
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

  async function handleSubmit() {
    if (!form.title.trim() || !form.image.trim()) {
      toast.error("Title and image are required");
      return;
    }
    const payload = {
      title: form.title.trim(),
      image: form.image.trim(),
      link: form.link.trim() || undefined,
      position: form.position,
      visibility: form.visibility,
      priority: Math.max(0, form.priority),
      startDate: fromScheduleInputValue(form.startDate) ?? undefined,
      endDate: fromScheduleInputValue(form.endDate) ?? undefined,
      isActive: form.isActive,
    };
    if (isEdit && bannerId) {
      const { persisted } = await updateBanner(bannerId, payload);
      reportWrite(persisted, "Banner updated");
    } else {
      const { persisted } = await createBanner(payload);
      reportWrite(persisted, "Banner created");
    }
    onSaved();
    onOpenChange(false);
  }

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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Banner" : "Add Banner"}</DialogTitle>
            <DialogDescription>
              Promotional banners with scheduling, priority, and visibility rules.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="banner-title">Title</Label>
              <Input
                id="banner-title"
                value={form.title}
                onChange={(e) => patchForm({ title: e.target.value })}
              />
            </div>

            <PhotoField
              id="banner-image"
              label="Image"
              aspect="wide"
              value={form.image}
              onChange={(url) => patchForm({ image: url })}
            />

            <div className="space-y-2">
              <Label htmlFor="banner-link">Link URL</Label>
              <Input
                id="banner-link"
                value={form.link}
                onChange={(e) => patchForm({ link: e.target.value })}
                placeholder="/store/collections"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="banner-position">Position</Label>
                <AdminSelect
                  id="banner-position"
                  value={form.position}
                  onChange={(e) =>
                    patchForm({ position: e.target.value as Banner["position"] })
                  }
                >
                  {bannerPositionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AdminSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner-visibility">Visibility</Label>
                <AdminSelect
                  id="banner-visibility"
                  value={form.visibility}
                  onChange={(e) =>
                    patchForm({ visibility: e.target.value as Banner["visibility"] })
                  }
                >
                  {bannerVisibilityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AdminSelect>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="banner-priority">Priority</Label>
                <Input
                  id="banner-priority"
                  type="number"
                  min={0}
                  value={form.priority}
                  onChange={(e) => patchForm({ priority: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner-start">Start date</Label>
                <Input
                  id="banner-start"
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) => patchForm({ startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="banner-end">End date</Label>
                <Input
                  id="banner-end"
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => patchForm({ endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Show this banner when within schedule.
                </p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => patchForm({ isActive: checked })}
              />
            </div>
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
            <Button
              variant="bakery"
              disabled={isEdit && !isDirty}
              onClick={() => void handleSubmit()}
            >
              {isEdit ? "Save changes" : "Create banner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              Unsaved edits to this banner will be lost.
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
