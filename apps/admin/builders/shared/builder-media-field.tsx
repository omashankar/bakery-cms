"use client";

import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { MediaPicker } from "@/apps/admin/products/components/media-picker";
import { SafeImage } from "@/components/shared/safe-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface BuilderMediaFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function BuilderMediaField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: BuilderMediaFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <ImageIcon className="size-4" />
          Media
        </Button>
      </div>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder ?? "https://..."}
      />
      {value ? (
        <div className="space-y-2">
          <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
            <SafeImage src={value} alt={label} className="object-cover" />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-muted-foreground"
            onClick={() => onChange("")}
          >
            Clear image
          </Button>
        </div>
      ) : null}
      <MediaPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={(url) => onChange(url)}
      />
    </div>
  );
}
