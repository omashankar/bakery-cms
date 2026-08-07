"use client";

import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  reportSettingsReset,
  reportSettingsWrite,
} from "@/apps/admin/settings/lib/report-settings-write";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SocialMark } from "@/components/shared/social-mark";
import { cn } from "@/lib/utils";
import type { SocialLinkSettings } from "@/types/settings";
import {
  createSocialLinkId,
  defaultSocialLinks,
  isSafeSocialUrl,
  socialPlatformOptions,
} from "@/features/settings/lib/settings-utils";
import {
  getSocialLinks,
  resetSocialLinks,
  saveSocialLinks,
} from "@/features/settings/lib/settings-repository";
import { useSettingsSection } from "@/features/settings/lib/use-settings-section";
import { SettingsSectionShell } from "./settings-section-shell";
import { FieldError, SettingsHydrationNotice } from "./settings-field-error";

function createSocialLink(): SocialLinkSettings {
  return {
    // Not `social-${Date.now()}`: two rows added in the same millisecond shared
    // an id, and `updateLink` matches on it — so editing one edited both.
    id: createSocialLinkId(),
    platform: "Instagram",
    href: "",
    label: "New link",
    // Starts hidden. A new row has no URL yet, and an active row without one is
    // invalid — so seeding it active would block Save for the whole section the
    // instant "Add link" is clicked.
    isActive: false,
  };
}

/**
 * Per-row errors, so the admin is told WHICH row is wrong, not just that one is.
 *
 * Mirrors `socialSchema` exactly, including that the URL rule applies to ACTIVE
 * rows only — a client rule that is merely close to the server's is worse than
 * none, because the difference surfaces as "the server rejected it", which reads
 * like an outage rather than a field to fix.
 *
 * Every field is read defensively: the Mongoose sub-schema declares these as
 * bare `String` with no default, so a row at rest can genuinely be missing one,
 * and this runs during render — an unguarded `.trim()` would crash the page
 * rather than show a message.
 */
function validateLink(link: SocialLinkSettings) {
  const href = link.href ?? "";
  const label = link.label ?? "";
  const platform = link.platform ?? "";

  return {
    href:
      !link.isActive || isSafeSocialUrl(href)
        ? ""
        : "An active link needs the full profile URL, starting with https://",
    label: label.trim() ? "" : "Label is required — it is the link's screen-reader name.",
    platform: (socialPlatformOptions as readonly string[]).includes(platform)
      ? ""
      : `"${platform}" is not one of the supported platforms — pick one from the list.`,
  };
}

export function SocialSettingsPage() {
  const { settings: links, isDirty, hydration, isWriting, canSave, edit, discard, runWrite } =
    useSettingsSection<SocialLinkSettings[]>(getSocialLinks, defaultSocialLinks);

  const errors = links.map(validateLink);
  const hasErrors = errors.some((error) => error.href || error.label || error.platform);
  const activeCount = links.filter((link) => link.isActive).length;

  function updateLink(id: string, patch: Partial<SocialLinkSettings>) {
    edit((prev) => prev.map((link) => (link.id === id ? { ...link, ...patch } : link)));
  }

  async function handleSave() {
    if (hasErrors || !canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await saveSocialLinks(links);
      return { value, accepted: reportSettingsWrite(persisted, "Social links") };
    });
  }

  function handleDiscard() {
    discard();
    toast.message("Discarded unsaved changes");
  }

  async function handleReset() {
    if (!canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await resetSocialLinks();
      return { value, accepted: reportSettingsReset(persisted, "Social links") };
    });
  }

  return (
    <SettingsSectionShell
      title="Social"
      description={
        hydration === "ready"
          ? `${activeCount} active of ${links.length} link${links.length === 1 ? "" : "s"}`
          : "Manage social profile links displayed in the site footer."
      }
      isDirty={isDirty}
      // Behind the skeleton until the SERVER's copy has landed. Editing the seed
      // makes the form dirty, the resync then skips it to protect that edit, and
      // Save replaces the shop's real profile links with the demo ones.
      mounted={hydration !== "pending"}
      isSaving={isWriting}
      saveDisabled={hasErrors || !canSave}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
      // Reset sits outside the gated form, so without this it is clickable
      // before hydration and its handler simply returns.
      resetDisabled={!canSave}
    >
      <SettingsHydrationNotice hydration={hydration} />
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Social profiles</CardTitle>
            <CardDescription>
              Inactive links are hidden from the public footer. Turn them all off and the footer
              shows no social row at all.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => edit((prev) => [...prev, createSocialLink()])}
          >
            <Plus className="size-4" />
            Add link
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {links.map((link, index) => (
            <div key={link.id} className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant={link.isActive ? "default" : "secondary"} className="gap-1.5">
                    <SocialMark platform={link.platform ?? ""} className="size-3.5" />
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
                    onClick={() => edit((prev) => prev.filter((item) => item.id !== link.id))}
                    // Removable even when it is the last one. The schema accepts
                    // an empty list and the footer handles it, so blocking here
                    // trapped an admin whose ONLY row was one `migrate()` had
                    // flagged: not deletable, not saveable, no way forward.
                    aria-label={`Remove ${link.platform ?? "social"} link`}
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
                    value={link.platform ?? ""}
                    aria-invalid={Boolean(errors[index].platform)}
                    aria-describedby={
                      errors[index].platform ? `platform-${link.id}-error` : undefined
                    }
                    className={cn(errors[index].platform && "border-destructive")}
                    onChange={(e) => updateLink(link.id, { platform: e.target.value })}
                  >
                    {/* A stored platform outside the list still has to be
                        selectable, or the picker silently shows "Instagram"
                        while the row holds something else and the save 422s. */}
                    {errors[index].platform ? (
                      <option value={link.platform ?? ""}>{link.platform || "—"}</option>
                    ) : null}
                    {socialPlatformOptions.map((platform) => (
                      <option key={platform} value={platform}>
                        {platform}
                      </option>
                    ))}
                  </AdminSelect>
                  <FieldError id={`platform-${link.id}-error`} message={errors[index].platform} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`label-${link.id}`}>Label</Label>
                  <Input
                    id={`label-${link.id}`}
                    value={link.label ?? ""}
                    aria-invalid={Boolean(errors[index].label)}
                    aria-describedby={errors[index].label ? `label-${link.id}-error` : undefined}
                    className={cn(errors[index].label && "border-destructive")}
                    onChange={(e) => updateLink(link.id, { label: e.target.value })}
                  />
                  <FieldError id={`label-${link.id}-error`} message={errors[index].label} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`url-${link.id}`}>URL</Label>
                <Input
                  id={`url-${link.id}`}
                  value={link.href ?? ""}
                  aria-invalid={Boolean(errors[index].href)}
                  aria-describedby={errors[index].href ? `url-${link.id}-error` : undefined}
                  className={cn(errors[index].href && "border-destructive")}
                  onChange={(e) => updateLink(link.id, { href: e.target.value })}
                  placeholder="https://instagram.com/yourshop"
                />
                <FieldError id={`url-${link.id}-error`} message={errors[index].href} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </SettingsSectionShell>
  );
}
