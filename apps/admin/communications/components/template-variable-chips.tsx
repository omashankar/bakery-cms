"use client";

import {
  availableVariablesFor,
  isSendableSlug,
  type TemplateChannel,
} from "@/features/communications/lib/template-contract";
import { COMMON_TEMPLATE_VARIABLES } from "@/features/communications/lib/template-sample-data";

interface TemplateVariableChipsProps {
  variables: string[];
  /**
   * The template being edited. Decides which variables are safe to offer — a
   * chip is a promise that the value will be there when the mail goes out.
   */
  slug?: string;
  onInsert?: (variable: string) => void;
  /**
   * Which sender the slug belongs to.
   *
   * The two contracts disagree, so the default was wrong on the WhatsApp
   * screen rather than merely unhelpful: it offered {{invoice_url}} for
   * order_confirmation, which the email sender supplies and the WhatsApp one
   * cannot — a link has to be inside the wording Meta approved.
   */
  channel?: TemplateChannel;
}

export function TemplateVariableChips({
  variables,
  slug,
  onInsert,
  channel = "email",
}: TemplateVariableChipsProps) {
  // Offer only what the SENDER for this template supplies.
  //
  // This was `[...variables, ...COMMON_TEMPLATE_VARIABLES]` for every template
  // alike, so the password-reset editor advertised `{{order_total}}` and the
  // invoice editor advertised `{{reset_code}}`. Insert one, and the preview
  // renders it happily — the preview fills every variable with sample data —
  // and the customer receives the literal `{{order_total}}`, because
  // `renderTemplate` leaves an unresolved key exactly as written.
  //
  // A template nothing sends has no contract to break, so it keeps the old
  // behaviour: its own variables plus the common set, as a starting point for
  // whenever a sender is written for it.
  const wired = slug ? isSendableSlug(slug, channel) : false;
  const chips = (
    wired
      ? availableVariablesFor(slug as string, variables, channel)
      : [...new Set([...variables, ...COMMON_TEMPLATE_VARIABLES])]
  ).slice(0, 16);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">
        {wired
          ? `Insert variables — these are supplied when this ${channel === "whatsapp" ? "message" : "email"} is sent`
          : "Insert variables"}
      </p>
      <div className="flex flex-wrap gap-2">
        {chips.map((variable) => (
          <button
            key={variable}
            type="button"
            className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-primary hover:border-primary/40 hover:bg-muted"
            onClick={() => onInsert?.(variable)}
          >
            {`{{${variable}}}`}
          </button>
        ))}
      </div>
    </div>
  );
}
