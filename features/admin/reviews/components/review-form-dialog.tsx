"use client";

import { useEffect, useMemo, useState } from "react";
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
import { AdminSelect, adminTextareaClassName } from "@/features/admin/cakes/components/admin-field";
import { loadCakes } from "@/features/admin/cakes/lib/cakes-repository";
import type { ProductReview, ProductReviewFormData } from "@/types/review";

interface ReviewFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ProductReview | null;
  onSubmit: (data: ProductReviewFormData, id?: string) => void;
}

export function ReviewFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: ReviewFormDialogProps) {
  const cakes = useMemo(() => loadCakes().filter((cake) => cake.status === "published"), []);
  const [cakeSlug, setCakeSlug] = useState(cakes[0]?.slug ?? "");
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<ProductReview["status"]>("pending");
  const [isFeatured, setIsFeatured] = useState(false);

  useEffect(() => {
    if (!open) return;
    const cake = cakes.find((item) => item.slug === (initial?.cakeSlug ?? cakes[0]?.slug));
    setCakeSlug(initial?.cakeSlug ?? cakes[0]?.slug ?? "");
    setAuthorName(initial?.authorName ?? "");
    setAuthorEmail(initial?.authorEmail ?? "");
    setRating(initial?.rating ?? 5);
    setTitle(initial?.title ?? "");
    setBody(initial?.body ?? "");
    setStatus(initial?.status ?? "pending");
    setIsFeatured(initial?.isFeatured ?? false);
    if (!initial && cake) setCakeSlug(cake.slug);
  }, [open, initial, cakes]);

  function handleSubmit() {
    const cake = cakes.find((item) => item.slug === cakeSlug);
    if (!cake || !authorName.trim() || !body.trim()) return;

    onSubmit(
      {
        cakeId: cake.id,
        cakeSlug: cake.slug,
        cakeName: cake.name,
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim() || undefined,
        rating,
        title: title.trim() || undefined,
        body: body.trim(),
        status,
        isFeatured,
        adminReply: initial?.adminReply,
        repliedAt: initial?.repliedAt,
        reportReason: initial?.reportReason,
        orderNumber: initial?.orderNumber,
      },
      initial?.id
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit review" : "Add review"}</DialogTitle>
          <DialogDescription>
            Product reviews appear on cake detail pages after approval.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="review-cake">Product</Label>
            <AdminSelect
              id="review-cake"
              value={cakeSlug}
              onChange={(event) => setCakeSlug(event.target.value)}
            >
              {cakes.map((cake) => (
                <option key={cake.id} value={cake.slug}>
                  {cake.name}
                </option>
              ))}
            </AdminSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-author">Customer name</Label>
            <Input
              id="review-author"
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-email">Email</Label>
            <Input
              id="review-email"
              type="email"
              value={authorEmail}
              onChange={(event) => setAuthorEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-rating">Rating</Label>
            <AdminSelect
              id="review-rating"
              value={String(rating)}
              onChange={(event) => setRating(Number(event.target.value))}
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} star{value === 1 ? "" : "s"}
                </option>
              ))}
            </AdminSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-status">Status</Label>
            <AdminSelect
              id="review-status"
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as ProductReview["status"])
              }
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="reported">Reported</option>
            </AdminSelect>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="review-title">Title (optional)</Label>
            <Input
              id="review-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="review-body">Review</Label>
            <textarea
              id="review-body"
              className={adminTextareaClassName}
              rows={4}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm sm:col-span-2">
            <Checkbox
              checked={isFeatured}
              onCheckedChange={(checked) => setIsFeatured(checked === true)}
            />
            Feature this review on the product page
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="bakery" onClick={handleSubmit}>
            {initial ? "Save review" : "Add review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
