"use client";

import { TemplatePreviewPanel } from "@/features/admin/communications/components/template-preview-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WhatsAppTemplateRecord } from "@/types/communication";

interface WhatsAppTemplatePreviewDialogProps {
  open: boolean;
  template: WhatsAppTemplateRecord | null;
  onOpenChange: (open: boolean) => void;
}

export function WhatsAppTemplatePreviewDialog({
  open,
  template,
  onOpenChange,
}: WhatsAppTemplatePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {template ? `Preview · ${template.name}` : "Preview"}
          </DialogTitle>
        </DialogHeader>

        {template ? (
          <TemplatePreviewPanel
            body={template.body}
            variables={template.variables}
            channel="whatsapp"
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
