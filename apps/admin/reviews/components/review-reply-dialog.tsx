"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import type { ProductReview } from "@/types/review";

interface ReviewReplyDialogProps {
  review: ProductReview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (reviewId: string, reply: string) => void;
}

export function ReviewReplyDialog({
  review,
  open,
  onOpenChange,
  onSave,
}: ReviewReplyDialogProps) {
  const [reply, setReply] = useState("");

  useEffect(() => {
    setReply(review?.adminReply ?? "");
  }, [review]);

  if (!review) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reply to review</DialogTitle>
          <DialogDescription>
            Public reply from the bakery team for {review.authorName}&apos;s review on{" "}
            {review.cakeName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="admin-reply">Admin reply</Label>
          <textarea
            id="admin-reply"
            className={adminTextareaClassName}
            rows={5}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder="Thank you for your kind words..."
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="bakery"
            onClick={() => {
              onSave(review.id, reply);
              onOpenChange(false);
            }}
          >
            Save reply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
