"use client";

import { COMMON_TEMPLATE_VARIABLES } from "../lib/template-sample-data";

interface TemplateVariableChipsProps {
  variables: string[];
  onInsert?: (variable: string) => void;
}

export function TemplateVariableChips({ variables, onInsert }: TemplateVariableChipsProps) {
  const chips = [...new Set([...variables, ...COMMON_TEMPLATE_VARIABLES])].slice(0, 16);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Insert variables</p>
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
