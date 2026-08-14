"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ExternalLink,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSelect, adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { slugify } from "@/features/products/lib/product-utils";
import { BuilderMediaField } from "@/apps/admin/builders/shared/builder-media-field";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { routes } from "@/constants/routes";
import {
  AdminMobileActionBar,
  AdminPage,
  AdminPageHeader,
} from "@/apps/admin/components";
import type {
  CmsPageAboutContent,
  CmsPageAboutHighlight,
  CmsPageAboutStat,
  CmsPageBlock,
  CmsPageFormData,
} from "@/types/content";
import { createEmptyPageForm } from "@/features/content/lib/pages-repository";
import {
  createPageRequest,
  deletePageRequest,
  fetchPage,
  updatePageRequest,
} from "@/features/content/data/pages-client";
import { getStorefrontPageUrl } from "@/features/content/lib/pages-utils";
import { DeletePageDialog } from "./delete-page-dialog";
import { fromScheduleInputValue, toScheduleInputValue } from "@/lib/datetime-local";

interface PageFormPageProps {
  mode: "add" | "edit";
  pageId?: string;
}

/**
 * Ids carry a random suffix as well as the clock.
 *
 * Two rows added in the same millisecond would otherwise share an id, and these
 * lists are keyed by it on both the form and the storefront.
 */
function createStat(): CmsPageAboutStat {
  return { id: `stat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, value: "", label: "" };
}

function createHighlight(): CmsPageAboutHighlight {
  return {
    id: `highlight-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    icon: "Award",
    title: "",
    description: "",
  };
}

function createBlock(type: CmsPageBlock["type"]): CmsPageBlock {
  return {
    id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    content: "",
  };
}

function serializeForm(form: CmsPageFormData): string {
  return JSON.stringify(form);
}

export function PageFormPage({ mode, pageId }: PageFormPageProps) {
  const router = useRouter();
  const [form, setForm] = useState<CmsPageFormData>(createEmptyPageForm);
  const [baseline, setBaseline] = useState(() => serializeForm(createEmptyPageForm()));
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSaving, setIsSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [metaTitleTouched, setMetaTitleTouched] = useState(mode === "edit");
  const [isSystem, setIsSystem] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isDirty = useMemo(() => serializeForm(form) !== baseline, [form, baseline]);

  useEffect(() => {
    /**
     * A response for the page we have NAVIGATED AWAY FROM must not land.
     *
     * The admin's global search moves straight from one page's editor to
     * another's, so this effect re-runs with a new `pageId` while the previous
     * request is still open. Without the flag, a slow response for page A
     * arrives afterwards and calls `setForm` and `setBaseline` with A's
     * content — under B's URL, and with A's serialisation as the "unchanged"
     * baseline. The form then looks clean, so nothing warns, and pressing
     * Publish writes A's content over page B. `product-form-page` has this
     * guard; this twin did not.
     */
    let cancelled = false;

    async function load() {
      if (mode !== "edit" || !pageId) {
        const empty = createEmptyPageForm();
        if (cancelled) return;
        setForm(empty);
        setBaseline(serializeForm(empty));
        setIsLoading(false);
        return;
      }

      let existing;
      try {
        existing = await fetchPage(pageId);
      } catch {
        if (cancelled) return;
        toast.error("Page not found");
        router.replace(routes.admin.pages.list);
        return;
      }
      if (cancelled) return;

      const { id: _id, createdAt: _c, updatedAt: _u, ...data } = existing;
      setForm(data);
      setBaseline(serializeForm(data));
      setIsSystem(existing.isSystem);
      setIsLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [mode, pageId, router]);

  useEffect(() => {
    if (!isDirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  function patch(next: Partial<CmsPageFormData>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  /**
   * EVERY About write goes through here, and it spreads.
   *
   * The server shallow-merges the patch — `{ ...stored, ...patch }` — so a
   * nested object is replaced wholesale, not merged. One call site that sets
   * `about` without spreading the previous value silently deletes every other
   * About field on save, with no error and no toast. The SEO fields on this
   * same form carry the identical hazard, which is why they spread too.
   */
  function patchAbout(next: Partial<CmsPageAboutContent>) {
    setForm((prev) => ({ ...prev, about: { ...prev.about, ...next } }));
  }

  const about = form.about ?? {};
  const aboutStats = about.stats ?? [];
  const aboutHighlights = about.highlights ?? [];

  function updateStat(id: string, next: Partial<CmsPageAboutStat>) {
    patchAbout({
      stats: aboutStats.map((stat) => (stat.id === id ? { ...stat, ...next } : stat)),
    });
  }

  function updateHighlight(id: string, next: Partial<CmsPageAboutHighlight>) {
    patchAbout({
      highlights: aboutHighlights.map((item) => (item.id === id ? { ...item, ...next } : item)),
    });
  }

  function handleTitleChange(title: string) {
    setForm((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugify(title),
      seo: {
        ...prev.seo,
        // Tracks the title until the admin edits the meta title themselves.
        //
        // The `||` meant the FIRST keystroke made this truthy and short-
        // circuited every one after: typing "Delivery Information" left the SEO
        // tab, the search preview and the stored record all reading
        // "D | Monginis" — which is the page's browser-tab and search-result
        // title. The brand was hard-coded too, in a CMS meant to run more than
        // one shop. `product-form-page` already holds this fix; this was the
        // twin it was not applied to.
        metaTitle: metaTitleTouched ? prev.seo?.metaTitle : title,
      },
    }));
  }

  function updateBlock(id: string, content: string) {
    setForm((prev) => ({
      ...prev,
      blocks: prev.blocks.map((block) =>
        block.id === id ? { ...block, content } : block
      ),
    }));
  }

  function moveBlock(id: string, direction: "up" | "down") {
    setForm((prev) => {
      const index = prev.blocks.findIndex((block) => block.id === id);
      if (index === -1) return prev;
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= prev.blocks.length) return prev;
      const next = [...prev.blocks];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, blocks: next };
    });
  }

  function removeBlock(id: string) {
    setForm((prev) => ({
      ...prev,
      blocks:
        prev.blocks.length > 1
          ? prev.blocks.filter((block) => block.id !== id)
          : prev.blocks,
    }));
  }

  function handleDiscard() {
    setForm(JSON.parse(baseline) as CmsPageFormData);
    toast.message("Discarded unsaved changes");
  }

  async function handleSubmit(status?: CmsPageFormData["status"]) {
    if (!form.title.trim()) {
      toast.error("Page title is required");
      return;
    }

    const payload: CmsPageFormData = {
      ...form,
      status: status ?? form.status,
      blocks: form.blocks.filter((block) => block.content.trim()),
      // A row with neither a figure nor a label says nothing, exactly as an
      // empty block does. A row with EITHER one is kept — half-filled is a
      // choice, not a mistake.
      about: {
        ...form.about,
        stats: (form.about?.stats ?? []).filter(
          (stat) => stat.value?.trim() || stat.label?.trim(),
        ),
        highlights: (form.about?.highlights ?? []).filter(
          (item) => item.title?.trim() || item.description?.trim(),
        ),
      },
    };

    if (payload.blocks.length === 0) {
      toast.error("Add at least one content block");
      return;
    }

    setIsSaving(true);
    try {
      if (mode === "add") {
        const created = await createPageRequest(payload);
        toast.success("Page created");
        router.push(routes.admin.pages.edit(created.id));
        return;
      }
      if (pageId) {
        await updatePageRequest(pageId, payload);
        setForm(payload);
        setBaseline(serializeForm(payload));
        toast.success("Page saved");
      }
    } catch (error) {
      // Keep the user on the form with their input intact so they can retry.
      toast.error(error instanceof Error ? error.message : "Could not save this page");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pageId || isSystem) return;
    try {
      await deletePageRequest(pageId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this page");
      return;
    }
    toast.success("Page deleted");
    router.replace(routes.admin.pages.list);
  }

  if (isLoading) {
    return (
      <AdminPage>
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AdminPage>
    );
  }

  const previewHref = form.slug
    ? `${getStorefrontPageUrl(form.slug)}${
        form.status === "published" ? "" : "?preview=1"
      }`
    : null;

  return (
    <AdminPage className="space-y-4 sm:space-y-5 pb-20 xl:pb-0">
      <AdminPageHeader
        title={mode === "add" ? "Add Page" : "Edit Page"}
        description={
          isDirty
            ? "Unsaved changes — save draft or publish when ready."
            : "Configure page content, layout template, and SEO metadata."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {previewHref ? (
              <Button
                variant="outline"
                render={<a href={previewHref} target="_blank" rel="noreferrer" />}
              >
                <ExternalLink className="size-4" />
                {form.status === "published" ? "View live" : "Preview draft"}
              </Button>
            ) : null}
            <Button variant="outline" render={<Link href={routes.admin.pages.list} />}>
              Back to pages
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <Tabs defaultValue="content" className="space-y-4">
          <TabsList>
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Page details</CardTitle>
                <CardDescription>
                  Title, slug, and summary shown in the page header.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="page-title">Title</Label>
                    <Input
                      id="page-title"
                      value={form.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      placeholder="About Us"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="page-slug">Slug</Label>
                    <Input
                      id="page-slug"
                      value={form.slug}
                      disabled={isSystem}
                      onChange={(e) => {
                        setSlugTouched(true);
                        patch({ slug: slugify(e.target.value) });
                      }}
                      placeholder="about-us"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="page-description">Description</Label>
                  <textarea
                    id="page-description"
                    className={adminTextareaClassName}
                    value={form.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    placeholder="Short summary for the page header..."
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="page-template">Template</Label>
                    <AdminSelect
                      id="page-template"
                      value={form.template}
                      onChange={(e) =>
                        patch({ template: e.target.value as CmsPageFormData["template"] })
                      }
                    >
                      <option value="standard">Standard</option>
                      <option value="about">About layout</option>
                    </AdminSelect>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="page-order">Sort order</Label>
                    <Input
                      id="page-order"
                      type="number"
                      min={1}
                      value={form.sortOrder}
                      onChange={(e) => patch({ sortOrder: Number(e.target.value) || 1 })}
                    />
                  </div>
                </div>
                {form.template === "about" ? (
                  <BuilderMediaField
                    id="page-hero"
                    label="Hero image"
                    value={form.heroImage ?? ""}
                    onChange={(next) => patch({ heroImage: next })}
                    placeholder="https://images.unsplash.com/..."
                  />
                ) : null}
              </CardContent>
            </Card>

            {/*
              The About template's own copy.

              Every one of these was a constant in `cms-page-view.tsx` and
              `landing-data.ts` — "Since 1965", "1M+ Happy customers", "Six
              decades of craft…" — which is the DEMO brand's history. This CMS
              runs many bakeries, so each of them published that as their own
              with no way to change it. Anything left blank here does not render
              at all, so a page nobody has filled in makes no claim.

              The placeholders show what the template used to say. They are
              hints, not values: nothing is saved until the admin types it.
            */}
            {form.template === "about" ? (
              <Card>
                <CardHeader>
                  <CardTitle>About page content</CardTitle>
                  <CardDescription>
                    Your shop&apos;s own figures and wording. Leave anything blank to hide it.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="about-badge-title">Badge over the hero image</Label>
                      <Input
                        id="about-badge-title"
                        value={about.badgeTitle ?? ""}
                        placeholder="Since 1965"
                        onChange={(event) => patchAbout({ badgeTitle: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="about-badge-subtitle">Badge second line</Label>
                      <Input
                        id="about-badge-subtitle"
                        value={about.badgeSubtitle ?? ""}
                        placeholder="Baking joy for generations"
                        onChange={(event) => patchAbout({ badgeSubtitle: event.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="about-story-label">Label above your story</Label>
                    <Input
                      id="about-story-label"
                      value={about.storyLabel ?? ""}
                      placeholder="Our Story"
                      onChange={(event) => patchAbout({ storyLabel: event.target.value })}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">Stats band</p>
                        <p className="text-xs text-muted-foreground">
                          Only add figures you can stand behind — customers read these as fact.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => patchAbout({ stats: [...aboutStats, createStat()] })}
                      >
                        <Plus className="size-4" />
                        Add stat
                      </Button>
                    </div>
                    {aboutStats.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                        No stats — the band will not appear on the page.
                      </p>
                    ) : (
                      aboutStats.map((stat) => (
                        <div
                          key={stat.id}
                          className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_1.5fr_auto]"
                        >
                          <Input
                            value={stat.value ?? ""}
                            placeholder="60+"
                            aria-label="Stat figure"
                            onChange={(event) => updateStat(stat.id, { value: event.target.value })}
                          />
                          <Input
                            value={stat.label ?? ""}
                            placeholder="Years of baking"
                            aria-label="Stat label"
                            onChange={(event) => updateStat(stat.id, { label: event.target.value })}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label="Remove stat"
                            onClick={() =>
                              patchAbout({ stats: aboutStats.filter((row) => row.id !== stat.id) })
                            }
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  <Separator />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="about-highlights-title">Highlights heading</Label>
                      <Input
                        id="about-highlights-title"
                        value={about.highlightsTitle ?? ""}
                        placeholder="Why Choose Us"
                        onChange={(event) => patchAbout({ highlightsTitle: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="about-highlights-description">Highlights subheading</Label>
                      <Input
                        id="about-highlights-description"
                        value={about.highlightsDescription ?? ""}
                        placeholder="What makes your bakery different"
                        onChange={(event) =>
                          patchAbout({ highlightsDescription: event.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Highlight cards</p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          patchAbout({ highlights: [...aboutHighlights, createHighlight()] })
                        }
                      >
                        <Plus className="size-4" />
                        Add card
                      </Button>
                    </div>
                    {aboutHighlights.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                        No cards — the section will not appear on the page.
                      </p>
                    ) : (
                      aboutHighlights.map((item) => (
                        <div key={item.id} className="space-y-2 rounded-xl border border-border p-3">
                          <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                            <AdminSelect
                              value={item.icon ?? "Award"}
                              aria-label="Card icon"
                              onChange={(event) =>
                                updateHighlight(item.id, { icon: event.target.value })
                              }
                            >
                              {["Award", "Leaf", "Truck", "Palette"].map((icon) => (
                                <option key={icon} value={icon}>
                                  {icon}
                                </option>
                              ))}
                            </AdminSelect>
                            <Input
                              value={item.title ?? ""}
                              placeholder="Premium Ingredients"
                              aria-label="Card title"
                              onChange={(event) =>
                                updateHighlight(item.id, { title: event.target.value })
                              }
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label="Remove card"
                              onClick={() =>
                                patchAbout({
                                  highlights: aboutHighlights.filter((row) => row.id !== item.id),
                                })
                              }
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
                          <textarea
                            className={adminTextareaClassName}
                            rows={2}
                            value={item.description ?? ""}
                            placeholder="What this means for your customers"
                            aria-label="Card description"
                            onChange={(event) =>
                              updateHighlight(item.id, { description: event.target.value })
                            }
                          />
                        </div>
                      ))
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="about-cta-title">Closing call to action</Label>
                    <Input
                      id="about-cta-title"
                      value={about.ctaTitle ?? ""}
                      placeholder="Ready to make your celebration sweeter?"
                      onChange={(event) => patchAbout({ ctaTitle: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="about-cta-description">Call to action text</Label>
                    <textarea
                      id="about-cta-description"
                      className={adminTextareaClassName}
                      rows={2}
                      value={about.ctaDescription ?? ""}
                      placeholder="Explore our cakes, or reach out for something custom."
                      onChange={(event) => patchAbout({ ctaDescription: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="about-cta-primary">Primary button</Label>
                      <Input
                        id="about-cta-primary"
                        value={about.ctaPrimaryLabel ?? ""}
                        placeholder="Browse Cakes"
                        onChange={(event) => patchAbout({ ctaPrimaryLabel: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="about-cta-secondary">Secondary button</Label>
                      <Input
                        id="about-cta-secondary"
                        value={about.ctaSecondaryLabel ?? ""}
                        placeholder="Contact Us"
                        onChange={(event) => patchAbout({ ctaSecondaryLabel: event.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle>Content blocks</CardTitle>
                  <CardDescription>
                    Add paragraphs and headings. About layout also shows the Why Choose Us grid.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      patch({ blocks: [...form.blocks, createBlock("paragraph")] })
                    }
                  >
                    <Plus className="size-4" />
                    Paragraph
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      patch({ blocks: [...form.blocks, createBlock("heading")] })
                    }
                  >
                    <Plus className="size-4" />
                    Heading
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {form.blocks.map((block, index) => (
                  <div key={block.id} className="rounded-xl border border-border p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <Badge variant="outline">
                        {block.type === "heading" ? "Heading" : "Paragraph"}
                      </Badge>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={index === 0}
                          onClick={() => moveBlock(block.id, "up")}
                          aria-label="Move up"
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={index === form.blocks.length - 1}
                          onClick={() => moveBlock(block.id, "down")}
                          aria-label="Move down"
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeBlock(block.id)}
                          aria-label="Remove block"
                          disabled={form.blocks.length <= 1}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                    {block.type === "heading" ? (
                      <Input
                        value={block.content}
                        onChange={(e) => updateBlock(block.id, e.target.value)}
                        placeholder="Section heading"
                      />
                    ) : (
                      <textarea
                        className={adminTextareaClassName}
                        value={block.content}
                        onChange={(e) => updateBlock(block.id, e.target.value)}
                        placeholder="Write paragraph content..."
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="seo">
            <Card>
              <CardHeader>
                <CardTitle>SEO</CardTitle>
                <CardDescription>Search engine title and description.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="meta-title">Meta title</Label>
                  <Input
                    id="meta-title"
                    value={form.seo?.metaTitle ?? ""}
                    onChange={(e) => {
                      // Once they type here, the title stops driving it.
                      setMetaTitleTouched(true);
                      patch({ seo: { ...form.seo, metaTitle: e.target.value } });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta-description">Meta description</Label>
                  <textarea
                    id="meta-description"
                    className={adminTextareaClassName}
                    value={form.seo?.metaDescription ?? ""}
                    onChange={(e) =>
                      patch({ seo: { ...form.seo, metaDescription: e.target.value } })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta-keywords">Keywords</Label>
                  <Input
                    id="meta-keywords"
                    value={form.seo?.metaKeywords?.join(", ") ?? ""}
                    onChange={(e) =>
                      patch({
                        seo: {
                          ...form.seo,
                          metaKeywords: e.target.value
                            .split(",")
                            .map((item) => item.trim())
                            .filter(Boolean),
                        },
                      })
                    }
                    placeholder="cakes, bakery, catering"
                  />
                </div>
                <BuilderMediaField
                  id="meta-og-image"
                  label="Open Graph image"
                  value={form.seo?.ogImage ?? ""}
                  onChange={(next) =>
                    patch({ seo: { ...form.seo, ogImage: next } })
                  }
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.seo?.noIndex ?? false}
                    onCheckedChange={(checked) =>
                      patch({ seo: { ...form.seo, noIndex: checked === true } })
                    }
                  />
                  Hide from search engines (noindex)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.seo?.noFollow ?? false}
                    onCheckedChange={(checked) =>
                      patch({ seo: { ...form.seo, noFollow: checked === true } })
                    }
                  />
                  Do not follow links (nofollow)
                </label>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Publish</CardTitle>
              <CardDescription>Control visibility on the public website.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="page-status">Status</Label>
                <AdminSelect
                  id="page-status"
                  value={form.status}
                  onChange={(e) =>
                    patch({ status: e.target.value as CmsPageFormData["status"] })
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </AdminSelect>
              </div>
              <div className="space-y-2">
                <Label htmlFor="page-schedule">Schedule publish</Label>
                <Input
                  id="page-schedule"
                  type="datetime-local"
                  className="min-w-0"
                  /**
                   * A `datetime-local` input reads and writes LOCAL wall clock;
                   * `toISOString()` yields UTC. Rendering one through the other
                   * shifted the displayed time by the UTC offset the moment it
                   * was set, and again on every subsequent edit — while the
                   * server really does auto-publish the page at the instant
                   * stored. An admin in IST scheduling 09:00 saw 03:30 on
                   * reopening, "corrected" it, and moved the real publish time
                   * by another five and a half hours.
                   *
                   * The homepage builder uses these two helpers for the same
                   * field; this form was doing the conversion by hand.
                   */
                  value={toScheduleInputValue(form.scheduledPublishAt)}
                  onChange={(event) =>
                    patch({
                      scheduledPublishAt:
                        fromScheduleInputValue(event.target.value) ?? undefined,
                    })
                  }
                />
                {form.scheduledPublishAt ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-muted-foreground"
                    onClick={() => patch({ scheduledPublishAt: undefined })}
                  >
                    Clear schedule
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Optional — auto-publishes when due in admin or storefront.
                  </p>
                )}
              </div>
              {isSystem ? (
                <p className="text-xs text-muted-foreground">
                  System page — slug is locked, content can still be edited.
                </p>
              ) : null}
              <Separator />
              <div className="hidden flex-col gap-2 xl:flex">
                {isDirty ? (
                  <Button variant="outline" disabled={isSaving} onClick={handleDiscard}>
                    Discard
                  </Button>
                ) : null}
                <Button
                  variant="bakery"
                  disabled={isSaving}
                  onClick={() => handleSubmit("published")}
                >
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                  Publish
                </Button>
                <Button
                  variant="outline"
                  disabled={isSaving || (!isDirty && mode === "edit")}
                  onClick={() => handleSubmit("draft")}
                >
                  Save draft
                </Button>
                {mode === "edit" && !isSystem ? (
                  <Button
                    variant="destructive"
                    disabled={isSaving}
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="size-4" />
                    Delete page
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <AdminMobileActionBar className="xl:hidden">
        {isDirty ? (
          <Button variant="outline" disabled={isSaving} onClick={handleDiscard}>
            Discard
          </Button>
        ) : null}
        <Button
          variant="outline"
          disabled={isSaving || (!isDirty && mode === "edit")}
          onClick={() => handleSubmit("draft")}
        >
          Save draft
        </Button>
        <Button
          variant="bakery"
          disabled={isSaving}
          onClick={() => handleSubmit("published")}
        >
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          Publish
        </Button>
      </AdminMobileActionBar>

      <DeletePageDialog
        open={deleteOpen}
        title={form.title}
        onOpenChange={setDeleteOpen}
        onConfirm={confirmDelete}
      />
    </AdminPage>
  );
}
