"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getSampleDataForVariables } from "@/features/admin/communications/lib/template-sample-data";
import { renderTemplate } from "@/features/admin/communications/lib/template-render";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WhatsAppTemplateRecord } from "@/types/communication";

interface WhatsAppTemplateTestSendDialogProps {
  open: boolean;
  template: WhatsAppTemplateRecord | null;
  onOpenChange: (open: boolean) => void;
}

export function WhatsAppTemplateTestSendDialog({
  open,
  template,
  onOpenChange,
}: WhatsAppTemplateTestSendDialogProps) {
  const [phone, setPhone] = useState("+91 98765 43210");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhone("+91 98765 43210");
  }, [open]);

  const preview = useMemo(() => {
    if (!template) return null;
    const sample = getSampleDataForVariables(template.variables);
    return renderTemplate(template.body, sample);
  }, [template]);

  async function handleSend() {
    if (!template) return;
    if (!phone.trim()) {
      toast.error("Enter a phone number");
      return;
    }

    setSending(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setSending(false);
    onOpenChange(false);
    toast.success("WhatsApp message queued (demo)", {
      description: `${template.name} → ${phone.trim()}`,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send test WhatsApp</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {template
              ? `Demo send for “${template.name}” using sample data. No real WhatsApp message is delivered.`
              : "Select a template first."}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
            Connect a WhatsApp Business / BSP provider in production to submit and send approved
            templates.
          </div>

          <div className="space-y-2">
            <Label htmlFor="test-wa-phone">Send to</Label>
            <Input
              id="test-wa-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>

          {preview ? (
            <div className="max-w-sm rounded-2xl rounded-tl-md border border-border bg-emerald-50 p-3 text-sm dark:bg-emerald-950/40">
              <p className="line-clamp-5 whitespace-pre-wrap text-foreground">{preview}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="bakery" disabled={!template || sending} onClick={handleSend}>
            {sending ? "Sending…" : "Send test"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
