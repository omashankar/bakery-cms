"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { getSampleDataForVariables } from "@/apps/admin/communications/lib/template-sample-data";
import { renderTemplate } from "@/lib/template-render";
import { sendTemplateTestRequest } from "@/apps/admin/communications/lib/communications-api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { EmailTemplateRecord } from "@/types/communication";

interface EmailTemplateTestSendDialogProps {
  open: boolean;
  /** The SAVED template — the endpoint reads the stored row, not a draft. */
  template: EmailTemplateRecord | null;
  /** Whether the editor holds edits this test will NOT include. */
  hasUnsavedChanges?: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EmailTemplateTestSendDialog({
  open,
  template,
  hasUnsavedChanges = false,
  onOpenChange,
}: EmailTemplateTestSendDialogProps) {
  const [sending, setSending] = useState(false);

  /*
    There WAS a client-side SMTP precheck here, and it read localStorage.

    `getSmtpSettings()` defaults to `enabled: false` when the cache is cold,
    and nothing on this route hydrates the settings store — the public
    settings endpoint omits `smtp` entirely, by design. So the first session
    after an in-app login refused to send a test the server would have
    accepted, and told the admin their SMTP was off while the SMTP page said
    it was on. It failed safe and it was still a screen asserting server
    state it had never read.

    The server already answers this question properly, with a reason, so the
    reason is what gets shown.
  */

  const preview = useMemo(() => {
    if (!template) return null;
    const sample = getSampleDataForVariables(template.variables, { slug: template.slug });
    return {
      subject: renderTemplate(template.subject, sample),
      body: renderTemplate(template.body, sample),
    };
  }, [template]);

  async function handleSend() {
    if (!template) return;
    setSending(true);
    const result = await sendTemplateTestRequest(template.slug);
    setSending(false);

    if (!result.sent) {
      toast.error("Could not send the test email", { description: result.error });
      return;
    }

    onOpenChange(false);
    toast.success("Test email sent", {
      description: `${template.name} → ${result.to}`,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send test email</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {/*
              This said "No real email is delivered" — which was true when the
              handler was a 900ms sleep, and became a lie the moment it started
              sending. A stale reassurance is worse than none: an admin reads it
              and stops watching their inbox.
            */}
            {template
              ? `Sends “${template.name}” to your own admin address, rendered with the sample data below.`
              : "Select a template first."}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {hasUnsavedChanges ? (
            <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
              You have unsaved edits. This test sends the SAVED version shown below —
              save first to test your changes.
            </p>
          ) : null}


          <div className="space-y-2">
            <Label>Send to</Label>
            {/*
              Not a free-text box any more. Honouring a caller-supplied
              recipient would turn this into a way to send mail from the
              shop's domain to anyone; the server ignores the body and mails
              the signed-in admin, the same rule the SMTP test follows.
            */}
            <p className="rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Your own admin address
            </p>
          </div>

          {preview ? (
            <div className="rounded-xl border border-border bg-muted p-3 text-sm">
              <p className="font-medium">{preview.subject}</p>
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-muted-foreground">
                {preview.body}
              </p>
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
