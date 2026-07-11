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
import { AdminSelect, adminTextareaClassName } from "@/features/admin/cakes/components/admin-field";
import { slugify } from "@/features/admin/cakes/lib/cake-utils";
import { BuilderMediaField } from "@/features/admin/builders/shared/builder-media-field";
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
} from "@/features/admin/components";
import type { CmsPageBlock, CmsPageFormData } from "@/types/content";
import {
  createEmptyPageForm,
  createPage,
  deletePages,
  getPageById,
  processScheduledPagePublishes,
  updatePage,
} from "../lib/pages-repository";
import { getStorefrontPageUrl } from "../lib/pages-utils";
import { DeletePageDialog } from "./delete-page-dialog";

interface PageFormPageProps {
  mode: "add" | "edit";
  pageId?: string;
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
  const [isSystem, setIsSystem] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isDirty = useMemo(() => serializeForm(form) !== baseline, [form, baseline]);

  useEffect(() => {
    processScheduledPagePublishes();

    if (mode !== "edit" || !pageId) {
      const empty = createEmptyPageForm();
      setForm(empty);
      setBaseline(serializeForm(empty));
      setIsLoading(false);
      return;
    }

    const existing = getPageById(pageId);
    if (!existing) {
      toast.error("Page not found");
      router.replace(routes.admin.pages.list);
      return;
    }

    const { id: _id, createdAt: _c, updatedAt: _u, ...data } = existing;
    setForm(data);
    setBaseline(serializeForm(data));
    setIsSystem(existing.isSystem);
    setIsLoading(false);
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

  function handleTitleChange(title: string) {
    setForm((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugify(title),
      seo: {
        ...prev.seo,
        metaTitle: prev.seo?.metaTitle || `${title} | Monginis`,
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
    };

    if (payload.blocks.length === 0) {
      toast.error("Add at least one content block");
      return;
    }

    setIsSaving(true);
    try {
      if (mode === "add") {
        const created = createPage(payload);
        toast.success("Page created");
        router.push(routes.admin.pages.edit(created.id));
        return;
      }
      if (pageId) {
        updatePage(pageId, payload);
        setForm(payload);
        setBaseline(serializeForm(payload));
        toast.success("Page saved");
      }
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDelete() {
    if (!pageId || isSystem) return;
    deletePages([pageId]);
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
                    onChange={(e) =>
                      patch({ seo: { ...form.seo, metaTitle: e.target.value } })
                    }
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
                  value={
                    form.scheduledPublishAt
                      ? new Date(form.scheduledPublishAt).toISOString().slice(0, 16)
                      : ""
                  }
                  onChange={(event) =>
                    patch({
                      scheduledPublishAt: event.target.value
                        ? new Date(event.target.value).toISOString()
                        : undefined,
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
