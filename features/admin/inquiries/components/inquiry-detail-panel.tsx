"use client";

import { Copy, Mail, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminSelect, adminTextareaClassName } from "@/features/admin/products/components/admin-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatDate, formatRelativeTime } from "@/utils/format";
import type { Inquiry, InquiryStatus } from "@/types/inquiry";
import { updateInquiry } from "@/features/inquiries/lib/inquiries-repository";
import { formatInquiryType } from "@/features/inquiries/lib/inquiry-utils";
import { InquiryStatusBadge } from "./inquiry-status-badge";

interface InquiryDetailPanelProps {
  inquiry: Inquiry | null;
  onUpdate: (inquiry: Inquiry) => void;
  onDelete: (inquiry: Inquiry) => void;
}

const statusOptions: InquiryStatus[] = ["new", "in_progress", "replied", "closed"];

export function InquiryDetailPanel({
  inquiry,
  onUpdate,
  onDelete,
}: InquiryDetailPanelProps) {
  if (!inquiry) {
    return (
      <div className="flex min-h-48 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Select an inquiry to read the message, update status, or add internal notes.
      </div>
    );
  }

  const current = inquiry;

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(current.email);
      toast.success("Email copied to clipboard");
    } catch {
      toast.error("Could not copy email");
    }
  }

  function saveStatus(status: InquiryStatus) {
    const updated = updateInquiry(current.id, { status });
    if (updated) onUpdate(updated);
  }

  function saveNotes(notes: string) {
    const updated = updateInquiry(current.id, { notes });
    if (updated) onUpdate(updated);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{current.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatInquiryType(current.type)} · {formatRelativeTime(current.createdAt)}
            </p>
          </div>
          <InquiryStatusBadge status={current.status} />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-4 shrink-0" />
            <span className="break-all">{current.email}</span>
          </div>
          {current.phone ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4 shrink-0" />
              <span>{current.phone}</span>
            </div>
          ) : null}
          <div>
            <p className="text-xs text-muted-foreground">Received</p>
            <p>{formatDate(current.createdAt)}</p>
          </div>
          {current.subject ? (
            <div>
              <p className="text-xs text-muted-foreground">Subject</p>
              <p className="font-medium">{current.subject}</p>
            </div>
          ) : null}
          {current.type === "wedding" ? (
            <div className="grid grid-cols-2 gap-3">
              {current.eventDate ? (
                <div>
                  <p className="text-xs text-muted-foreground">Event date</p>
                  <p>{formatDate(current.eventDate)}</p>
                </div>
              ) : null}
              {current.guestCount ? (
                <div>
                  <p className="text-xs text-muted-foreground">Guests</p>
                  <p>{current.guestCount}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-muted p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Message</p>
          <p className="text-sm whitespace-pre-wrap">{current.message}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inquiry-status">Status</Label>
          <AdminSelect
            id="inquiry-status"
            value={current.status}
            onChange={(e) => saveStatus(e.target.value as InquiryStatus)}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === "new"
                  ? "New"
                  : status === "in_progress"
                    ? "In Progress"
                    : status === "replied"
                      ? "Replied"
                      : "Closed"}
              </option>
            ))}
          </AdminSelect>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inquiry-notes">Internal notes</Label>
          <textarea
            id="inquiry-notes"
            className={adminTextareaClassName}
            defaultValue={current.notes ?? ""}
            placeholder="Add notes for your team (not visible to customer)"
            onBlur={(e) => saveNotes(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="outline" onClick={copyEmail}>
            <Copy className="size-4" />
            Copy email
          </Button>
          <Button
            variant="outline"
            render={<a href={`mailto:${current.email}`} />}
          >
            <Mail className="size-4" />
            Reply via email
          </Button>
          <Button variant="destructive" onClick={() => onDelete(current)}>
            <Trash2 className="size-4" />
            Delete inquiry
          </Button>
        </div>
      </div>
    </div>
  );
}
