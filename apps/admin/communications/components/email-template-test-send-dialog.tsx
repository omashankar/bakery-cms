"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { getSampleDataForVariables } from "@/apps/admin/communications/lib/template-sample-data";
import { renderTemplate } from "@/lib/template-render";
import { getSmtpSettings } from "@/features/settings/lib/settings-repository";
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
import { routes } from "@/constants/routes";
import type { EmailTemplateRecord } from "@/types/communication";

interface EmailTemplateTestSendDialogProps {
  open: boolean;
  template: EmailTemplateRecord | null;
  onOpenChange: (open: boolean) => void;
}

export function EmailTemplateTestSendDialog({
  open,
  template,
  onOpenChange,
}: EmailTemplateTestSendDialogProps) {
  const [sending, setSending] = useState(false);
  const [smtpEnabled, setSmtpEnabled] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSmtpEnabled(getSmtpSettings().enabled);
  }, [open]);

  const preview = useMemo(() => {
    if (!template) return null;
    const sample = getSampleDataForVariables(template.variables);
    return {
      subject: renderTemplate(template.subject, sample),
      body: renderTemplate(template.body, sample),
    };
  }, [template]);

  async function handleSend() {
    if (!template) return;
    if (!smtpEnabled) {
      toast.error("Enable SMTP before sending a test email", {
        description: "Open SMTP settings to turn on delivery.",
      });
      return;
    }
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
          {!smtpEnabled ? (
            <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
              SMTP is off.{" "}
              <Link
                href={routes.admin.settings.smtp}
                className="font-medium underline underline-offset-2"
              >
                Open SMTP settings
              </Link>
            </div>
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
