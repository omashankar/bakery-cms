"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminSelect, adminTextareaClassName } from "@/features/admin/products/components/admin-field";
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
import type { FaqFormData } from "@/types/content";
import {
  createEmptyFaqForm,
  createFaq,
  getFaqById,
  updateFaq,
} from "@/features/content/lib/faq-repository";
import { faqCategoryOptions } from "@/features/content/lib/faq-utils";

interface FaqFormDialogProps {
  open: boolean;
  faqId?: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

function serializeForm(form: FaqFormData): string {
  return JSON.stringify(form);
}

export function FaqFormDialog({ open, faqId, onOpenChange, onSaved }: FaqFormDialogProps) {
  const [form, setForm] = useState<FaqFormData>(createEmptyFaqForm);
  const [baseline, setBaseline] = useState(() => serializeForm(createEmptyFaqForm()));
  const [discardOpen, setDiscardOpen] = useState(false);
  const isEdit = Boolean(faqId);
  const isDirty = useMemo(() => serializeForm(form) !== baseline, [form, baseline]);

  useEffect(() => {
    if (!open) {
      setDiscardOpen(false);
      return;
    }

    if (faqId) {
      const existing = getFaqById(faqId);
      if (existing) {
        const { id: _id, createdAt: _c, updatedAt: _u, ...data } = existing;
        setForm(data);
        setBaseline(serializeForm(data));
      }
      return;
    }

    const empty = createEmptyFaqForm();
    setForm(empty);
    setBaseline(serializeForm(empty));
  }, [open, faqId]);

  function patch(next: Partial<FaqFormData>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  function handleDiscard() {
    setForm(JSON.parse(baseline) as FaqFormData);
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
    if (!form.question.trim() || !form.answer.trim()) {
      toast.error("Question and answer are required");
      return;
    }

    if (isEdit && faqId) {
      updateFaq(faqId, form);
      toast.success("FAQ updated");
    } else {
      createFaq(form);
      toast.success("FAQ created");
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
            <DialogTitle>{isEdit ? "Edit FAQ" : "Add FAQ"}</DialogTitle>
            <DialogDescription>
              Questions and answers shown on the FAQ page and builder sections.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="faq-question">Question</Label>
              <Input
                id="faq-question"
                value={form.question}
                onChange={(e) => patch({ question: e.target.value })}
                placeholder="How far in advance should I order?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="faq-answer">Answer</Label>
              <textarea
                id="faq-answer"
                className={adminTextareaClassName}
                value={form.answer}
                onChange={(e) => patch({ answer: e.target.value })}
                placeholder="Write a clear, helpful answer..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="faq-category">Category</Label>
                <AdminSelect
                  id="faq-category"
                  value={form.category}
                  onChange={(e) =>
                    patch({ category: e.target.value as FaqFormData["category"] })
                  }
                >
                  {faqCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </AdminSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="faq-status">Status</Label>
                <AdminSelect
                  id="faq-status"
                  value={form.status}
                  onChange={(e) =>
                    patch({ status: e.target.value as FaqFormData["status"] })
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </AdminSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="faq-order">Sort order</Label>
                <Input
                  id="faq-order"
                  type="number"
                  min={1}
                  value={form.sortOrder}
                  onChange={(e) => patch({ sortOrder: Number(e.target.value) || 1 })}
                />
              </div>
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
              onClick={handleSubmit}
            >
              {isEdit ? "Save changes" : "Add FAQ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard changes?</DialogTitle>
            <DialogDescription>
              Unsaved edits to this FAQ will be lost.
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
