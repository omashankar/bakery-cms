"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { AdminSelect, adminTextareaClassName } from "@/features/admin/products/components/admin-field";
import { MediaPicker } from "@/features/admin/products/components/media-picker";
import { SafeImage } from "@/components/shared/safe-image";
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
import type { TestimonialFormData } from "@/types/content";
import {
  createEmptyTestimonialForm,
  createTestimonial,
  getTestimonialById,
  updateTestimonial,
} from "@/features/content/lib/testimonials-repository";

interface TestimonialFormDialogProps {
  open: boolean;
  testimonialId?: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function serializeForm(form: TestimonialFormData): string {
  return JSON.stringify(form);
}

export function TestimonialFormDialog({
  open,
  testimonialId,
  onOpenChange,
  onSaved,
}: TestimonialFormDialogProps) {
  const [form, setForm] = useState<TestimonialFormData>(createEmptyTestimonialForm);
  const [baseline, setBaseline] = useState(() => serializeForm(createEmptyTestimonialForm()));
  const [mediaOpen, setMediaOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const isEdit = Boolean(testimonialId);
  const isDirty = useMemo(() => serializeForm(form) !== baseline, [form, baseline]);

  useEffect(() => {
    if (!open) {
      setMediaOpen(false);
      setDiscardOpen(false);
      return;
    }

    if (testimonialId) {
      const existing = getTestimonialById(testimonialId);
      if (existing) {
        const { id: _id, createdAt: _c, updatedAt: _u, ...data } = existing;
        setForm(data);
        setBaseline(serializeForm(data));
      }
      return;
    }

    const empty = createEmptyTestimonialForm();
    setForm(empty);
    setBaseline(serializeForm(empty));
  }, [open, testimonialId]);

  function patch(next: Partial<TestimonialFormData>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  function handleDiscard() {
    setForm(JSON.parse(baseline) as TestimonialFormData);
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

  function handleSubmit() {
    if (!form.name.trim() || !form.content.trim()) {
      toast.error("Name and review text are required");
      return;
    }

    if (isEdit && testimonialId) {
      updateTestimonial(testimonialId, form);
      toast.success("Testimonial updated");
    } else {
      createTestimonial(form);
      toast.success("Testimonial created");
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
            <DialogTitle>{isEdit ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle>
            <DialogDescription>
              Customer reviews shown on the homepage, wedding page, and landing site.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="testimonial-name">Customer name</Label>
                <Input
                  id="testimonial-name"
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="Priya Sharma"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="testimonial-role">Role / label</Label>
                <Input
                  id="testimonial-role"
                  value={form.role}
                  onChange={(e) => patch({ role: e.target.value })}
                  placeholder="Wedding Client"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="testimonial-content">Review</Label>
              <textarea
                id="testimonial-content"
                className={adminTextareaClassName}
                value={form.content}
                onChange={(e) => patch({ content: e.target.value })}
                placeholder="Share what the customer said..."
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="testimonial-avatar">Avatar</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMediaOpen(true)}
                >
                  <ImageIcon className="size-4" />
                  Media
                </Button>
              </div>
              <Input
                id="testimonial-avatar"
                value={form.avatar}
                onChange={(e) => patch({ avatar: e.target.value })}
                placeholder="https://… or pick from Media Library"
              />
              {form.avatar ? (
                <div className="flex items-center gap-3">
                  <div className="relative size-14 overflow-hidden rounded-full border border-border bg-muted">
                    <SafeImage
                      src={form.avatar}
                      alt={form.name || "Avatar preview"}
                      className="object-cover"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs text-muted-foreground"
                    onClick={() => patch({ avatar: "" })}
                  >
                    Clear avatar
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="testimonial-rating">Rating</Label>
                <AdminSelect
                  id="testimonial-rating"
                  value={String(form.rating)}
                  onChange={(e) => patch({ rating: Number(e.target.value) })}
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} stars
                    </option>
                  ))}
                </AdminSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="testimonial-status">Status</Label>
                <AdminSelect
                  id="testimonial-status"
                  value={form.status}
                  onChange={(e) =>
                    patch({ status: e.target.value as TestimonialFormData["status"] })
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </AdminSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="testimonial-order">Sort order</Label>
                <Input
                  id="testimonial-order"
                  type="number"
                  min={1}
                  value={form.sortOrder}
                  onChange={(e) => patch({ sortOrder: Number(e.target.value) || 1 })}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isFeatured}
                onCheckedChange={(checked) => patch({ isFeatured: checked === true })}
              />
              Feature this review on homepage sections
            </label>
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
              onClick={handleSubmit}
            >
              {isEdit ? "Save changes" : "Add testimonial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MediaPicker
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        onSelect={(url) => {
          patch({ avatar: url });
          setMediaOpen(false);
        }}
      />

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              Unsaved edits to this testimonial will be lost.
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
