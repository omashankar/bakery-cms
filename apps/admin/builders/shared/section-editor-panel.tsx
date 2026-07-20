"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  HeroSlideContent,
  SectionBackground,
  SectionFieldDef,
} from "@/types/homepage-builder";
import { parseHeroSlides } from "@/constants/section-registry";
import { routes } from "@/constants/routes";
import { AdminSelect, adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { Button } from "@/components/ui/button";
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

/** Repeatable editor for the hero carousel's slides (stored as JSON in content). */
function SlidesField({
  content,
  onChange,
}: {
  content: Record<string, string | number | boolean>;
  onChange: (next: string) => void;
}) {
  const slides = parseHeroSlides(content);
  const commit = (next: HeroSlideContent[]) => onChange(JSON.stringify(next));

  const updateSlide = (index: number, patch: Partial<HeroSlideContent>) =>
    commit(slides.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)));

  const addSlide = () =>
    commit([
      ...slides,
      {
        headline: "New slide",
        subtext: "",
        primaryLabel: "Shop Now",
        primaryHref: routes.store.collections,
        imageUrl: "",
      },
    ]);

  const removeSlide = (index: number) => commit(slides.filter((_, i) => i !== index));

  const moveSlide = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  return (
    <div className="space-y-3">
      {slides.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
          No slides yet — add your first slide below.
        </p>
      ) : null}

      {slides.map((slide, index) => (
        <div key={index} className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">Slide {index + 1}</p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={index === 0}
                onClick={() => moveSlide(index, -1)}
                aria-label="Move slide up"
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={index === slides.length - 1}
                onClick={() => moveSlide(index, 1)}
                aria-label="Move slide down"
              >
                <ChevronDown className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-destructive"
                onClick={() => removeSlide(index)}
                aria-label="Remove slide"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`slide-${index}-badge`}>Badge</Label>
            <Input
              id={`slide-${index}-badge`}
              value={slide.badge ?? ""}
              onChange={(e) => updateSlide(index, { badge: e.target.value })}
              placeholder="Featured"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`slide-${index}-headline`}>Headline</Label>
            <Input
              id={`slide-${index}-headline`}
              value={slide.headline ?? ""}
              onChange={(e) => updateSlide(index, { headline: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`slide-${index}-subtext`}>Subtext</Label>
            <textarea
              id={`slide-${index}-subtext`}
              className={adminTextareaClassName}
              value={slide.subtext ?? ""}
              onChange={(e) => updateSlide(index, { subtext: e.target.value })}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`slide-${index}-plabel`}>Primary button</Label>
              <Input
                id={`slide-${index}-plabel`}
                value={slide.primaryLabel ?? ""}
                onChange={(e) => updateSlide(index, { primaryLabel: e.target.value })}
                placeholder="Shop Now"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`slide-${index}-phref`}>Primary link</Label>
              <Input
                id={`slide-${index}-phref`}
                value={slide.primaryHref ?? ""}
                onChange={(e) => updateSlide(index, { primaryHref: e.target.value })}
                placeholder="/store/collections"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`slide-${index}-slabel`}>Secondary button</Label>
              <Input
                id={`slide-${index}-slabel`}
                value={slide.secondaryLabel ?? ""}
                onChange={(e) => updateSlide(index, { secondaryLabel: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`slide-${index}-shref`}>Secondary link</Label>
              <Input
                id={`slide-${index}-shref`}
                value={slide.secondaryHref ?? ""}
                onChange={(e) => updateSlide(index, { secondaryHref: e.target.value })}
                placeholder="/store/wedding-cakes"
              />
            </div>
          </div>
          <BuilderMediaField
            id={`slide-${index}-image`}
            label="Slide image"
            value={slide.imageUrl ?? ""}
            onChange={(next) => updateSlide(index, { imageUrl: next })}
          />
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="w-full" onClick={addSlide}>
        <Plus className="size-4" />
        Add slide
      </Button>
    </div>
  );
}

function renderField<T extends BuilderEditableSection>(
  field: SectionFieldDef,
  section: T,
  updateContent: (key: string, value: string | number | boolean) => void
) {
  const value = section.content[field.key];

  if (field.type === "slides") {
    return (
      <SlidesField
        key={field.key}
        content={section.content}
        onChange={(next) => updateContent(field.key, next)}
      />
    );
  }

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
