"use client";

import { TemplatePreviewPanel } from "@/apps/admin/communications/components/template-preview-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { EmailTemplateRecord } from "@/types/communication";

interface EmailTemplatePreviewDialogProps {
  open: boolean;
  template: EmailTemplateRecord | null;
  onOpenChange: (open: boolean) => void;
}

export function EmailTemplatePreviewDialog({
  open,
  template,
  onOpenChange,
}: EmailTemplatePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {template ? `Preview · ${template.name}` : "Preview"}
          </DialogTitle>
        </DialogHeader>

        {template ? (
          <TemplatePreviewPanel
            subject={template.subject}
            previewText={template.previewText}
            body={template.body}
            variables={template.variables}
            channel="email"
            embedded
          />
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
