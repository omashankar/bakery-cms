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

interface DeletePageDialogProps {
  open: boolean;
  title?: string;
  count?: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeletePageDialog({
  open,
  title,
  count = 1,
  onOpenChange,
  onConfirm,
}: DeletePageDialogProps) {
  const label = count > 1 ? `${count} pages` : `"${title ?? "this page"}"`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {count > 1 ? "pages" : "page"}?</DialogTitle>
          <DialogDescription>
            Delete {label}? System pages cannot be removed. This cannot be undone in the demo CMS.
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
