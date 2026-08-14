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
import { isUsageIndexReady } from "@/apps/admin/media/lib/media-usage";

interface DeleteMediaDialogProps {
  open: boolean;
  fileName?: string;
  count?: number;
  inUse?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteMediaDialog({
  open,
  fileName,
  count = 1,
  inUse = false,
  onOpenChange,
  onConfirm,
}: DeleteMediaDialogProps) {
  const label = count > 1 ? `${count} files` : `"${fileName ?? "this file"}"`;
  // "Nothing uses this" and "I have not looked yet" are different answers, and
  // this dialog is where the difference costs something: with Cloudinary
  // configured the asset is destroyed, not delisted, and everything pointing at
  // it renders a broken image.
  const usageKnown = isUsageIndexReady();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {count > 1 ? "files" : "file"}?</DialogTitle>
          <DialogDescription>
            Delete {label}? This cannot be undone, and anything still pointing at
            it will show a broken image.
            {inUse
              ? " This file is used in published content."
              : usageKnown
                ? null
                : " Still checking where this is used — give it a moment, or delete anyway."}
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
