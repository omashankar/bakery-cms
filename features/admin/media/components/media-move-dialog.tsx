"use client";

import { AdminSelect } from "@/features/admin/products/components/admin-field";
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
import type { MediaFolder } from "@/types/media";

interface MediaMoveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: MediaFolder[];
  count: number;
  folderId: string;
  onFolderChange: (folderId: string) => void;
  onConfirm: () => void;
}

export function MediaMoveDialog({
  open,
  onOpenChange,
  folders,
  count,
  folderId,
  onFolderChange,
  onConfirm,
}: MediaMoveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move to folder</DialogTitle>
          <DialogDescription>
            Move {count} selected file{count === 1 ? "" : "s"} to another folder.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="move-folder">Destination folder</Label>
          <AdminSelect
            id="move-folder"
            value={folderId}
            onChange={(event) => onFolderChange(event.target.value)}
          >
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </AdminSelect>
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="bakery"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Move files
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
