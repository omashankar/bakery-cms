"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { getSampleDataForVariables } from "@/apps/admin/communications/lib/template-sample-data";
import { renderTemplate } from "@/apps/admin/communications/lib/template-render";
import { getSmtpSettings } from "@/features/settings/lib/settings-repository";
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
  const [to, setTo] = useState("demo@bakery.test");
  const [sending, setSending] = useState(false);
  const [smtpEnabled, setSmtpEnabled] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSmtpEnabled(getSmtpSettings().enabled);
    setTo("demo@bakery.test");
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
    if (!to.trim()) {
      toast.error("Enter a recipient email");
      return;
    }

    setSending(true);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setSending(false);
    onOpenChange(false);
    toast.success("Test email queued (demo)", {
      description: `${template.name} → ${to.trim()}`,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send test email</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {template
              ? `Demo send for “${template.name}” using sample data. No real email is delivered.`
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
            <Label htmlFor="test-email-to">Send to</Label>
            <Input
              id="test-email-to"
              type="email"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="you@example.com"
            />
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
