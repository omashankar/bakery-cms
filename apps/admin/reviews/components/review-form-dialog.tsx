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
import { AdminSelect, adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { loadProducts } from "@/features/products/lib/products-repository";
import type { ProductReview, ProductReviewFormData } from "@/types/review";
import { PRODUCTS_UPDATED_EVENT } from "@/features/products/lib/products-repository";
import { toast } from "sonner";
import type { Product } from "@/types/product";

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
  /**
   * The catalogue, re-read whenever it changes and whenever the dialog opens.
   *
   * This was an empty-dep `useMemo`, computed on the page's first client render
   * — before `useProductCacheSync` had fetched anything — and never recomputed.
   * On a fresh browser that is the shipped demo catalogue, so the Product
   * dropdown offered cakes the shop does not sell and the server refused every
   * submission.
   *
   * The review being EDITED is folded in, because the list is published-only:
   * a review of a draft, archived or since-deleted product had no matching
   * option, and `handleSubmit` below then returned without a word.
   */
  const [published, setPublished] = useState<Product[]>([]);

  useEffect(() => {
    const read = () => setPublished(loadProducts().filter((cake) => cake.status === "published"));
    read();
    window.addEventListener(PRODUCTS_UPDATED_EVENT, read);
    return () => window.removeEventListener(PRODUCTS_UPDATED_EVENT, read);
    // `open` re-reads when the dialog is reopened, in case the catalogue moved
    // on while it was closed.
  }, [open]);

  const cakes = useMemo(() => {
    if (!initial) return published;
    if (published.some((cake) => cake.slug === initial.productSlug)) return published;
    // Its own product, kept selectable so the review can still be edited.
    return [
      ...published,
      {
        id: initial.cakeId,
        slug: initial.productSlug,
        name: initial.cakeName,
        status: "published",
      } as Product,
    ];
  }, [initial, published]);
  const [productSlug, setCakeSlug] = useState(cakes[0]?.slug ?? "");
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<ProductReview["status"]>("pending");
  const [isFeatured, setIsFeatured] = useState(false);

  useEffect(() => {
    if (!open) return;
    const cake = cakes.find((item) => item.slug === (initial?.productSlug ?? cakes[0]?.slug));
    setCakeSlug(initial?.productSlug ?? cakes[0]?.slug ?? "");
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
    /**
     * Three different refusals, which were one silent `return`.
     *
     * Save did nothing at all — no toast, no field error, nothing — and did it
     * every time, so the admin clicked, watched the dialog sit there, and
     * eventually gave up. The product case was the one that could not be
     * escaped: the list is published-only, so any review of a draft or archived
     * cake was unfixable and unexplained.
     */
    const cake = cakes.find((item) => item.slug === productSlug);
    if (!cake) {
      toast.error("Choose a product for this review");
      return;
    }
    if (!authorName.trim()) {
      toast.error("The review needs a customer name");
      return;
    }
    if (!body.trim()) {
      toast.error("The review needs something to say");
      return;
    }

    onSubmit(
      {
        cakeId: cake.id,
        productSlug: cake.slug,
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
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
              value={productSlug}
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
