"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getSampleDataForVariables } from "@/apps/admin/communications/lib/template-sample-data";
import { sendWhatsAppTestRequest } from "@/apps/admin/communications/lib/communications-api";
import { renderTemplate } from "@/lib/template-render";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [sending, setSending] = useState(false);

  const preview = useMemo(() => {
    if (!template) return null;
    const sample = getSampleDataForVariables(template.variables);
    return renderTemplate(template.body, sample);
  }, [template]);

  async function handleSend() {
    if (!template || sending) return;

    setSending(true);
    // A real send through Meta. This was a 900ms timer followed by a SUCCESS
    // toast reading "WhatsApp message queued (demo)" — and "queued" is the word
    // a real provider uses, so the parenthesis was doing a great deal of work.
    const result = await sendWhatsAppTestRequest(template.slug);
    setSending(false);

    if (!result.sent) {
      toast.error("Test message not sent", { description: result.error });
      return;
    }

    onOpenChange(false);
    toast.success("Test WhatsApp sent", {
      description: result.to ? `Delivered to ${result.to}.` : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send test WhatsApp</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {template
              ? `Sends “${template.name}” with sample data to your shop's own contact number.`
              : "Select a template first."}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {/*
            No recipient box. There was one, defaulted to a plausible number,
            and honouring it would have made this a way to send WhatsApp
            messages from the shop's VERIFIED business number to any number at
            all. The server picks the recipient — the shop's own contact number
            from Settings → Contact — for the same reason the email test only
            mails the signed-in admin.
          */}
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            The test goes to the contact number in Settings → Contact, and arrives in the wording
            Meta approved for this template — not the draft below, which is your reference copy.
          </div>

          {preview ? (
            <div className="max-w-sm rounded-2xl rounded-tl-md border border-border bg-emerald-50 p-3 text-sm dark:bg-emerald-950/40">
              <p className="line-clamp-5 whitespace-pre-wrap text-foreground">{preview}</p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
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
