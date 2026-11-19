"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteCustomerAccount } from "@/apps/website/account/lib/customer-session";

/**
 * "DELETE YOUR ACCOUNT?" — says plainly what goes and what stays (orders are
 * the shop's tax record), then asks the server. The caller is told only once
 * the server has actually deleted it.
 */
export function DeleteAccountDialog({
  open,
  onOpenChange,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSending(true);
    setError(null);
    const result = await deleteCustomerAccount();
    setSending(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onDeleted();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (sending) return;
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete your account?</DialogTitle>
          <DialogDescription>
            Your name, phone number, saved addresses and profile photo will be deleted, and you
            will be signed out everywhere. Your past orders stay with the shop for tax records.
            This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Keep my account
          </Button>
          <Button variant="destructive" onClick={() => void submit()} disabled={sending}>
            {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
            Delete account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
