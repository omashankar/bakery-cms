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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!authorName.trim() || !body.trim()) {
      toast.error("Please add your name and review");
      return;
    }

    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 400));

    const review = submitStorefrontReview({
      productSlug,
      authorName,
      authorEmail,
      rating,
      title,
      body,
    });

    setSubmitting(false);

    if (!review) {
      toast.error("Could not submit review");
      return;
    }

    setAuthorName("");
    setAuthorEmail("");
    setRating(5);
    setTitle("");
    setBody("");
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

        <Button type="submit" variant="bakery" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit review"}
        </Button>
      </div>
    </form>
  );
}
