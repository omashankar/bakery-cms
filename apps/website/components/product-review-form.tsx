"use client";

import { useState } from "react";
import { toast } from "sonner";
import { StarRating } from "@/components/shared/star-rating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitStorefrontReview } from "@/features/reviews/lib/reviews-repository";

interface ProductReviewFormProps {
  productSlug: string;
  cakeName: string;
  onSubmitted?: () => void;
}

export function ProductReviewForm({ productSlug, cakeName, onSubmitted }: ProductReviewFormProps) {
  const [authorName, setAuthorName] = useState("");
  const [authorEmail, setAuthorEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /**
   * Photos, uploaded as they are chosen rather than at submit.
   *
   * The endpoint answers with a URL the shop has already stored, so what the
   * review carries is a reference to something that exists — and the customer
   * finds out a photo was refused while they can still pick another one,
   * rather than losing the whole review to it.
   */
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const MAX_PHOTOS = 4;

  async function handlePhoto(file: File) {
    if (photoUrls.length >= MAX_PHOTOS) {
      toast.error(`Up to ${MAX_PHOTOS} photos`);
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("photo", file);
      const res = await fetch("/api/uploads/photo-cake", {
        method: "POST",
        credentials: "same-origin",
        body,
      });
      const parsed = (await res.json().catch(() => null)) as
        | { data?: { url?: string }; message?: string }
        | null;
      if (!res.ok || !parsed?.data?.url) {
        toast.error(parsed?.message ?? "Could not upload that photo");
        return;
      }
      setPhotoUrls((current) => [...current, parsed.data!.url!]);
    } catch {
      toast.error("Could not reach the shop");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!authorName.trim() || !body.trim()) {
      toast.error("Please add your name and review");
      return;
    }

    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const { review, persisted } = await submitStorefrontReview({
      productSlug,
      // Already on this page. It used to be looked up instead, through the
      // admin's product cache, which on a customer's browser holds the shipped
      // demo catalogue — so a real product could never be reviewed.
      cakeName,
      authorName,
      authorEmail,
      rating,
      title,
      body,
      photoUrls,
    });

    setSubmitting(false);

    if (!review) {
      toast.error("Could not submit review");
      return;
    }

    if (!persisted) {
      // Keep the form filled — this is the customer's only copy of what they
      // wrote, and "pending approval" would be a promise nobody can keep: the
      // review never reached the bakery, so no moderator will ever see it.
      toast.error("We couldn't send your review", {
        description: "Please check your connection and try again.",
      });
      return;
    }

    setAuthorName("");
    setAuthorEmail("");
    setRating(5);
    setTitle("");
    setBody("");
    setPhotoUrls([]);
    toast.success("Thank you! Your review is pending approval.");
    onSubmitted?.();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-cream-50 p-4"
    >
      <p className="text-sm font-medium">Write a review for {cakeName}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Reviews are moderated before appearing on the storefront.
      </p>

      <div className="mt-4 space-y-3">
        <div className="space-y-2">
          <Label htmlFor="review-rating-select">Rating</Label>
          <div className="flex flex-wrap items-center gap-3">
            <select
              id="review-rating-select"
              value={rating}
              onChange={(event) => setRating(Number(event.target.value))}
              className="flex h-10 rounded-lg border border-input bg-white px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} star{value === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            <StarRating rating={rating} size="sm" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="review-name">Your name</Label>
            <Input
              id="review-name"
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="review-email">Email (optional)</Label>
            <Input
              id="review-email"
              type="email"
              value={authorEmail}
              onChange={(event) => setAuthorEmail(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="review-title">Title (optional)</Label>
          <Input
            id="review-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="review-body">Your review</Label>
          <Textarea
            id="review-body"
            rows={4}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="review-photos">Photos (optional)</Label>
          <div className="flex flex-wrap items-center gap-2">
            {photoUrls.map((url) => (
              <span
                key={url}
                className="relative size-16 overflow-hidden rounded-lg border border-border bg-white"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  aria-label="Remove photo"
                  className="absolute top-0 right-0 bg-white/90 px-1 text-xs"
                  onClick={() =>
                    setPhotoUrls((current) => current.filter((kept) => kept !== url))
                  }
                >
                  ×
                </button>
              </span>
            ))}
            {photoUrls.length < MAX_PHOTOS ? (
              <input
                id="review-photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  // Cleared so choosing the same file twice still fires.
                  event.target.value = "";
                  if (file) void handlePhoto(file);
                }}
                className="text-xs"
              />
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {uploading
              ? "Uploading…"
              : "A photo of what you received. Shown with your review once it is approved."}
          </p>
        </div>

        <Button type="submit" variant="bakery" disabled={submitting || uploading}>
          {submitting ? "Submitting..." : "Submit review"}
        </Button>
      </div>
    </form>
  );
}
