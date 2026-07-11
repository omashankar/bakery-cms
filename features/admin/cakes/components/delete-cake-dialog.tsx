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

interface DeleteCakeDialogProps {
  open: boolean;
  cakeName?: string;
  count?: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DeleteCakeDialog({
  open,
  cakeName,
  count = 1,
  onOpenChange,
  onConfirm,
}: DeleteCakeDialogProps) {
  const label = count > 1 ? `${count} cakes` : `"${cakeName ?? "this cake"}"`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {count > 1 ? "cakes" : "cake"}?</DialogTitle>
          <DialogDescription>
            Delete {label}? This cannot be undone in the demo store.
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
