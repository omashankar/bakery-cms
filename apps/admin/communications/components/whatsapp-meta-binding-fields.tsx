"use client";

import { AlertTriangle, CheckCircle2, Clock, HelpCircle } from "lucide-react";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { availableVariablesFor } from "@/features/communications/lib/template-contract";
import {
  countSurplusParameters,
  countUnfilledSlots,
} from "@/apps/admin/communications/lib/whatsapp-template-utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WhatsAppTemplateRecord } from "@/types/communication";
import type { MetaTemplateSummary, WhatsAppApprovalStatus } from "@/types/whatsapp-provider";

/**
 * The half of a WhatsApp template that decides what a customer actually reads.
 *
 * The editor next to this one is the shop's own copy of the wording — useful for
 * a preview, and for writing the template in Meta's dashboard in the first
 * place. It is not what gets delivered. WhatsApp only carries wording Meta has
 * approved, selected by NAME, with values passed by POSITION: `{{1}}`, `{{2}}`.
 *
 * So this component does two things the editor cannot. It says plainly which
 * approved template this row is bound to and whether Meta has actually approved
 * it, and it maps each numbered slot to a variable. That mapping is the part
 * worth being careful about: nothing at send time can tell that `{{1}}` was
 * supposed to be the order number, so an order swapped with a date is delivered
 * successfully, in approved wording, saying the wrong thing.
 */

interface WhatsAppMetaBindingFieldsProps {
  draft: WhatsAppTemplateRecord;
  /** Templates Meta reported at the last sync. Empty before one has run. */
  available: MetaTemplateSummary[];
  onPatch: (patch: Partial<WhatsAppTemplateRecord>) => void;
}

const APPROVAL_META: Record<
  WhatsAppApprovalStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  approved: {
    label: "Approved by Meta",
    className:
      "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100",
    icon: CheckCircle2,
  },
  pending: {
    label: "Waiting on Meta",
    className: "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100",
    icon: Clock,
  },
  rejected: {
    label: "Rejected by Meta",
    className: "bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-100",
    icon: AlertTriangle,
  },
  not_submitted: {
    label: "Not checked with Meta",
    className: "bg-muted text-muted-foreground",
    icon: HelpCircle,
  },
};

export function WhatsAppMetaBindingFields({
  draft,
  available,
  onPatch,
}: WhatsAppMetaBindingFieldsProps) {
  const metaName = draft.metaName ?? "";
  const linked = available.find((template) => template.name === metaName) ?? null;
  const approval = draft.approval ?? "not_submitted";
  const badge = APPROVAL_META[approval];
  const BadgeIcon = badge.icon;

  const parameters = draft.metaParameters ?? [];
  // Meta is authoritative on how many parameters the approved body takes. Until
  // a sync has run there is nothing to be authoritative WITH, so the shop's own
  // mapping decides the row count and can be grown by hand.
  const slots = linked ? linked.parameterCount : parameters.length;

  const variableOptions = availableVariablesFor(draft.slug, draft.variables, "whatsapp");

  const unfilled = countUnfilledSlots(slots, parameters);
  const surplus = countSurplusParameters(slots, parameters);

  function setParameter(index: number, value: string) {
    const next = Array.from({ length: slots }, (_, position) =>
      position === index ? value : (parameters[position] ?? ""),
    );
    onPatch({ metaParameters: next });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Approved WhatsApp template</h3>
          <p className="text-xs text-muted-foreground">
            What the customer actually receives. The copy above is your reference and the preview.
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
        >
          <BadgeIcon className="h-3.5 w-3.5" />
          {badge.label}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="wa-meta-name">Template name at Meta</Label>
          {available.length ? (
            <AdminSelect
              id="wa-meta-name"
              value={metaName}
              onChange={(event) => onPatch({ metaName: event.target.value })}
            >
              <option value="">Not linked</option>
              {available.map((template) => (
                <option key={`${template.name}|${template.language}`} value={template.name}>
                  {template.name} ({template.language}) — {template.status.replace("_", " ")}
                </option>
              ))}
              {/*
                A name the shop had linked before that Meta no longer lists is
                kept as an option rather than silently dropped. Removing it from
                the list would reset the field to "Not linked" the moment this
                renders, quietly discarding a binding the admin never touched.
              */}
              {metaName && !linked ? (
                <option value={metaName}>{metaName} — no longer at Meta</option>
              ) : null}
            </AdminSelect>
          ) : (
            <>
              <Input
                id="wa-meta-name"
                value={metaName}
                onChange={(event) => onPatch({ metaName: event.target.value })}
                placeholder="order_confirmation_v1"
              />
              <p className="text-xs text-muted-foreground">
                Run “Sync with Meta” above to pick from the templates on your account instead of
                typing the name.
              </p>
            </>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="wa-meta-language">Language</Label>
          <Input
            id="wa-meta-language"
            value={draft.metaLanguage ?? ""}
            onChange={(event) => onPatch({ metaLanguage: event.target.value })}
            placeholder="en"
          />
          <p className="text-xs text-muted-foreground">
            Meta holds each language separately — a mismatch fails as “template does not exist”.
          </p>
        </div>
      </div>

      {linked ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Approved wording</p>
          <p className="whitespace-pre-wrap rounded-lg border border-border bg-background p-3 text-sm">
            {linked.body}
          </p>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Fill the numbered slots</Label>
          {!linked && slots > 0 ? (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => onPatch({ metaParameters: parameters.slice(0, -1) })}
            >
              Remove last
            </button>
          ) : null}
        </div>

        {slots === 0 ? (
          <p className="text-xs text-muted-foreground">
            This template takes no variables — Meta&apos;s approved wording has no{" "}
            <code className="rounded bg-muted px-1">{"{{1}}"}</code> placeholders.
          </p>
        ) : (
          <div className="space-y-2">
            {Array.from({ length: slots }, (_, index) => (
              <div key={index} className="flex items-center gap-2">
                <code className="w-12 shrink-0 rounded bg-muted px-2 py-1 text-center text-xs">
                  {`{{${index + 1}}}`}
                </code>
                <AdminSelect
                  aria-label={`Value for placeholder ${index + 1}`}
                  value={parameters[index] ?? ""}
                  onChange={(event) => setParameter(index, event.target.value)}
                >
                  <option value="">Choose a value…</option>
                  {variableOptions.map((variable) => (
                    <option key={variable} value={variable}>
                      {variable}
                    </option>
                  ))}
                </AdminSelect>
              </div>
            ))}
          </div>
        )}

        {!linked ? (
          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => onPatch({ metaParameters: [...parameters, ""] })}
          >
            Add a placeholder
          </button>
        ) : null}

        {/*
          Said here rather than discovered on a customer's order.

          Meta rejects a message whose parameter count does not match the
          approved body, and the error it returns names no parameter — so an
          unfilled slot surfaces as an order that quietly got no WhatsApp
          message and a line in a log nobody is reading. The count is knowable
          right here, the moment the admin can still fix it.
        */}
        {slots > 0 && unfilled > 0 ? (
          <p className="text-xs text-amber-700 dark:text-amber-300" role="alert">
            {unfilled} of {slots} placeholder{slots === 1 ? "" : "s"} has no value. Meta refuses a
            message that does not fill every one of them.
          </p>
        ) : null}

        {/*
          And the other direction, which nothing said.

          `countUnfilledSlots` walks Meta's slot count, so a mapping LONGER than
          the approved body counted zero blanks and this alert never rendered.
          Meta rejects a mismatch in either direction — with `parameterCount: 0`
          the panel above positively says "This template takes no variables"
          while the surplus rows sit in the record — so the send failed with
          nothing on screen to explain it. Said here, where the count is known
          and the admin can still fix it.
        */}
        {surplus > 0 ? (
          <p className="text-xs text-amber-700 dark:text-amber-300" role="alert">
            {surplus} more value{surplus === 1 ? " is" : "s are"} mapped than Meta&apos;s approved
            wording takes ({slots} placeholder{slots === 1 ? "" : "s"}). Meta refuses a message
            whose parameter count does not match, in either direction.
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Order matters: the first row fills <code className="rounded bg-muted px-1">{"{{1}}"}</code>{" "}
          in Meta&apos;s wording. Nothing at send time can tell these apart, so a swap is delivered
          successfully saying the wrong thing.
        </p>
      </div>
    </div>
  );
}
