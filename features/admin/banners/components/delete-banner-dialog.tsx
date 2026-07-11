"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteBannerDialogProps {
  open: boolean;
  title?: string;
  count?: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteBannerDialog({
  open,
  title,
  count = 1,
  onOpenChange,
  onConfirm,
}: DeleteBannerDialogProps) {
  const label = count > 1 ? `${count} banners` : `"${title ?? "this banner"}"`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {count > 1 ? "banners" : "banner"}?</DialogTitle>
          <DialogDescription>
            Delete {label}? This cannot be undone in the demo CMS.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
