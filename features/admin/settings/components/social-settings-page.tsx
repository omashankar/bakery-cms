"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminSelect } from "@/features/admin/cakes/components/admin-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { SocialLinkSettings } from "@/types/settings";
import { defaultSocialLinks, socialPlatformOptions } from "../lib/settings-utils";
import {
  getSocialLinks,
  resetSocialLinks,
  saveSocialLinks,
} from "../lib/settings-repository";
import { SettingsSectionShell } from "./settings-section-shell";

function createSocialLink(): SocialLinkSettings {
  return {
    id: `social-${Date.now()}`,
    platform: "Instagram",
    href: "https://",
    label: "New link",
    isActive: true,
  };
}

export function SocialSettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [links, setLinks] = useState<SocialLinkSettings[]>(defaultSocialLinks);
  const [savedLinks, setSavedLinks] = useState<SocialLinkSettings[]>(defaultSocialLinks);

  useEffect(() => {
    const loaded = getSocialLinks();
    setLinks(loaded);
    setSavedLinks(loaded);
    setMounted(true);
  }, []);

  const isDirty = JSON.stringify(links) !== JSON.stringify(savedLinks);
  const activeCount = links.filter((link) => link.isActive).length;

  function updateLink(id: string, patch: Partial<SocialLinkSettings>) {
    setLinks((prev) => prev.map((link) => (link.id === id ? { ...link, ...patch } : link)));
  }

  function handleSave() {
    const saved = saveSocialLinks(links);
    setSavedLinks(saved);
    setLinks(saved);
    toast.success("Social links saved");
  }

  function handleDiscard() {
    setLinks(savedLinks);
    toast.message("Discarded unsaved changes");
  }

  function handleReset() {
    const loaded = resetSocialLinks();
    setLinks(loaded);
    setSavedLinks(loaded);
    toast.success("Social links reset to defaults");
  }

  return (
    <SettingsSectionShell
      title="Social"
      description={
        mounted
          ? `${activeCount} active of ${links.length} link${links.length === 1 ? "" : "s"}`
          : "Manage social profile links displayed in the site footer."
      }
      isDirty={isDirty}
      mounted={mounted}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
    >
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Social profiles</CardTitle>
            <CardDescription>Inactive links are hidden from the public footer.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLinks((prev) => [...prev, createSocialLink()])}
          >
            <Plus className="size-4" />
            Add link
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {links.map((link) => (
            <div key={link.id} className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={link.isActive ? "default" : "secondary"}>
                    {link.platform}
                  </Badge>
                  {!link.isActive ? (
                    <span className="text-xs text-muted-foreground">Hidden</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`active-${link.id}`} className="text-xs">
                      Active
                    </Label>
                    <Switch
                      id={`active-${link.id}`}
                      checked={link.isActive}
                      onCheckedChange={(checked) => updateLink(link.id, { isActive: checked })}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setLinks((prev) => prev.filter((item) => item.id !== link.id))}
                    disabled={links.length <= 1}
                    aria-label="Remove social link"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`platform-${link.id}`}>Platform</Label>
                  <AdminSelect
                    id={`platform-${link.id}`}
                    value={link.platform}
                    onChange={(e) => updateLink(link.id, { platform: e.target.value })}
                  >
                    {socialPlatformOptions.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </AdminSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`label-${link.id}`}>Label</Label>
                  <Input
                    id={`label-${link.id}`}
                    value={link.label}
                    onChange={(e) => updateLink(link.id, { label: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`url-${link.id}`}>URL</Label>
                <Input
                  id={`url-${link.id}`}
                  value={link.href}
                  onChange={(e) => updateLink(link.id, { href: e.target.value })}
                  placeholder="https://"
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </SettingsSectionShell>
  );
}
