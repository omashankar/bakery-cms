"use client";

import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SectionBackground, SectionFieldDef } from "@/types/homepage-builder";
import { AdminSelect, adminTextareaClassName } from "@/features/admin/cakes/components/admin-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BuilderMediaField } from "./builder-media-field";

export interface BuilderEditableSection {
  instanceId: string;
  type: string;
  background: SectionBackground;
  content: Record<string, string | number | boolean>;
}

interface SectionEditorPanelProps<T extends BuilderEditableSection> {
  section: T | null;
  onChange: (section: T) => void;
  resolveEntry: (type: T["type"]) => { label: string; fields: SectionFieldDef[] } | undefined;
  settingsNote?: string;
}

function renderField<T extends BuilderEditableSection>(
  field: SectionFieldDef,
  section: T,
  updateContent: (key: string, value: string | number | boolean) => void
) {
  const value = section.content[field.key];

  if (field.type === "boolean") {
    return (
      <div key={field.key} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
        <Label htmlFor={field.key}>{field.label}</Label>
        <Switch
          id={field.key}
          checked={value === true || value === "true"}
          onCheckedChange={(checked) => updateContent(field.key, checked)}
        />
      </div>
    );
  }

  if (field.type === "select" && field.options?.length) {
    return (
      <div key={field.key} className="space-y-2">
        <Label htmlFor={field.key}>{field.label}</Label>
        <AdminSelect
          id={field.key}
          value={String(value ?? field.options[0]?.value ?? "")}
          onChange={(event) => updateContent(field.key, event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </AdminSelect>
      </div>
    );
  }

  if (field.type === "url" && field.isImage) {
    return (
      <BuilderMediaField
        key={field.key}
        id={field.key}
        label={field.label}
        value={String(value ?? "")}
        onChange={(next) => updateContent(field.key, next)}
        placeholder={field.placeholder}
      />
    );
  }

  return (
    <div key={field.key} className="space-y-2">
      <Label htmlFor={field.key}>{field.label}</Label>
      {field.type === "textarea" ? (
        <textarea
          id={field.key}
          className={adminTextareaClassName}
          value={String(value ?? "")}
          onChange={(e) => updateContent(field.key, e.target.value)}
        />
      ) : (
        <Input
          id={field.key}
          type={field.type === "number" ? "number" : "text"}
          value={String(value ?? "")}
          onChange={(e) =>
            updateContent(
              field.key,
              field.type === "number" ? Number(e.target.value) || 0 : e.target.value
            )
          }
          placeholder={field.placeholder}
        />
      )}
    </div>
  );
}

export function SectionEditorPanel<T extends BuilderEditableSection>({
  section,
  onChange,
  resolveEntry,
  settingsNote = "Product and catalog data still comes from the mock store until the CMS content layer is fully connected.",
}: SectionEditorPanelProps<T>) {
  if (!section) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Editor</p>
          <p className="text-xs text-muted-foreground">No section selected</p>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Select a section from the list or preview.
        </div>
      </div>
    );
  }

  const entry = resolveEntry(section.type);
  if (!entry) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        This section type is no longer available.
      </div>
    );
  }

  const current = section;

  function updateContent(key: string, value: string | number | boolean) {
    onChange({
      ...current,
      content: { ...current.content, [key]: value },
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-3">
        <p className="truncate text-sm font-semibold">{entry.label}</p>
        <p className="text-xs text-muted-foreground">Edit content & settings</p>
      </div>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
        <Tabs key={section.instanceId} defaultValue="content">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="content" className="flex-1">
              Content
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            {entry.fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                This section has no editable content fields.
              </p>
            ) : (
              entry.fields.map((field) => renderField(field, current, updateContent))
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="background">Background</Label>
              <AdminSelect
                id="background"
                value={section.background}
                onChange={(e) =>
                  onChange({
                    ...current,
                    background: e.target.value as SectionBackground,
                  })
                }
              >
                <option value="white">White</option>
                <option value="cream">Cream</option>
              </AdminSelect>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{settingsNote}</p>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
