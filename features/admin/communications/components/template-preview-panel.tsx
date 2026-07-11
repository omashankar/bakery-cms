"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSampleDataForVariables } from "../lib/template-sample-data";
import { renderTemplate } from "../lib/template-render";
import { cn } from "@/lib/utils";

interface TemplatePreviewPanelProps {
  title?: string;
  description?: string;
  subject?: string;
  previewText?: string;
  body: string;
  variables: string[];
  channel: "email" | "whatsapp";
  /** When true, render without outer Card chrome (for dialogs). */
  embedded?: boolean;
  className?: string;
}

export function TemplatePreviewPanel({
  title = "Live preview",
  description = "Rendered with sample customer and order data.",
  subject,
  previewText,
  body,
  variables,
  channel,
  embedded = false,
  className,
}: TemplatePreviewPanelProps) {
  const sampleData = useMemo(() => getSampleDataForVariables(variables), [variables]);
  const renderedSubject = subject ? renderTemplate(subject, sampleData) : undefined;
  const renderedPreview = previewText ? renderTemplate(previewText, sampleData) : undefined;
  const renderedBody = renderTemplate(body, sampleData);

  const content = (
    <div className={cn("space-y-4", className)}>
      {channel === "email" ? (
        <div className="rounded-xl border border-border bg-card p-4">
          {renderedSubject ? (
            <p className="text-sm font-semibold text-foreground">{renderedSubject}</p>
          ) : null}
          {renderedPreview ? (
            <p className="mt-1 text-xs text-muted-foreground">{renderedPreview}</p>
          ) : null}
          <div className="mt-4 whitespace-pre-wrap border-t border-border pt-4 text-sm text-muted-foreground">
            {renderedBody}
          </div>
        </div>
      ) : (
        <div className="max-w-sm rounded-2xl rounded-tl-md border border-border bg-emerald-50 p-4 shadow-sm dark:bg-emerald-950/40">
          <p className="mb-2 text-[10px] font-semibold tracking-wide text-emerald-900/70 uppercase dark:text-emerald-200/80">
            WhatsApp preview
          </p>
          <div className="whitespace-pre-wrap text-sm text-foreground">{renderedBody}</div>
          <p className="mt-2 text-right text-[10px] text-muted-foreground">12:45 PM</p>
        </div>
      )}

      <div className="rounded-lg border border-dashed border-border bg-muted px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">Sample data used</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {variables.slice(0, 8).map((variable) => (
            <span
              key={variable}
              className="rounded bg-card px-2 py-0.5 text-[11px] text-muted-foreground"
            >
              {variable}: {sampleData[variable]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <Card className="h-fit shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
