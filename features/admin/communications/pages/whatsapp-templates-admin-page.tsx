"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  FileText,
  MessageCircle,
  Plus,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AdminMobileActionBar, AdminPage, AdminPageHeader } from "@/features/admin/components";
import { AdminSelect, adminTextareaClassName } from "@/features/admin/products/components/admin-field";
import { DashboardStatCard } from "@/features/admin/dashboard/components/dashboard-stat-card";
import { TemplatePreviewPanel } from "@/features/admin/communications/components/template-preview-panel";
import { TemplateStatusBadge } from "@/features/admin/communications/components/template-status-badge";
import { TemplateVariableChips } from "@/features/admin/communications/components/template-variable-chips";
import { WhatsAppTemplatePreviewDialog } from "@/features/admin/communications/components/whatsapp-template-preview-dialog";
import { WhatsAppTemplateTestSendDialog } from "@/features/admin/communications/components/whatsapp-template-test-send-dialog";
import {
  createWhatsAppTemplate,
  deleteWhatsAppTemplate,
  loadWhatsAppTemplates,
  resetWhatsAppTemplates,
  saveWhatsAppTemplate,
  WHATSAPP_TEMPLATES_UPDATED_EVENT,
} from "@/features/admin/communications/lib/whatsapp-templates-repository";
import {
  defaultWhatsAppTemplateFilters,
  EMPTY_WHATSAPP_TEMPLATE_OVERVIEW,
  filterWhatsAppTemplates,
  getWhatsAppTemplateOverview,
  type WhatsAppTemplateListFilters,
} from "@/features/admin/communications/lib/whatsapp-template-utils";
import { mergeTemplateVariables } from "@/features/admin/communications/lib/template-render";
import { formatTemplateCategory } from "@/features/admin/communications/lib/template-utils";
import {
  FilterPanel,
  FilterPanelSearch,
} from "@/components/shared/filter-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WhatsAppTemplateRecord } from "@/types/communication";
import { cn } from "@/lib/utils";

export function WhatsAppTemplatesAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [templates, setTemplates] = useState<WhatsAppTemplateRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<WhatsAppTemplateRecord | null>(null);
  const [filters, setFilters] = useState<WhatsAppTemplateListFilters>(
    defaultWhatsAppTemplateFilters
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testSendOpen, setTestSendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    function refresh() {
      const loaded = loadWhatsAppTemplates();
      setTemplates(loaded);
      setMounted(true);
      setSelectedId((current) => {
        if (current && loaded.some((template) => template.id === current)) return current;
        return loaded[0]?.id ?? null;
      });
    }

    refresh();
    window.addEventListener(WHATSAPP_TEMPLATES_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(WHATSAPP_TEMPLATES_UPDATED_EVENT, refresh);
  }, []);

  const overview = useMemo(
    () => (mounted ? getWhatsAppTemplateOverview(templates) : EMPTY_WHATSAPP_TEMPLATE_OVERVIEW),
    [templates, mounted]
  );

  const filtered = useMemo(
    () => filterWhatsAppTemplates(templates, filters),
    [templates, filters]
  );

  const savedSelected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [templates, selectedId]
  );

  useEffect(() => {
    if (!selectedId) {
      setDraft(null);
      return;
    }
    const next = templates.find((template) => template.id === selectedId) ?? null;
    setDraft(next);
  }, [selectedId, templates]);

  const isDirty =
    !!draft &&
    !!savedSelected &&
    JSON.stringify({
      ...draft,
      updatedAt: undefined,
      createdAt: undefined,
    }) !==
      JSON.stringify({
        ...savedSelected,
        updatedAt: undefined,
        createdAt: undefined,
      });

  function updateFilters(patch: Partial<WhatsAppTemplateListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function guardDirty(): boolean {
    if (!isDirty) return true;
    toast.error("Save or discard changes first");
    return false;
  }

  function selectTemplate(template: WhatsAppTemplateRecord) {
    if (template.id === selectedId) return;
    if (!guardDirty()) return;
    setSelectedId(template.id);
  }

  function patchDraft(patch: Partial<WhatsAppTemplateRecord>) {
    if (!draft) return;
    setDraft({
      ...draft,
      ...patch,
      variables: mergeTemplateVariables(patch.variables ?? draft.variables, [
        patch.body ?? draft.body,
      ]),
    });
  }

  function insertVariable(variable: string) {
    if (!draft) return;
    patchDraft({ body: `${draft.body}{{${variable}}}` });
  }

  function handleSave() {
    if (!draft) return;
    if (!draft.name.trim() || !draft.slug.trim() || !draft.body.trim()) {
      toast.error("Name, slug, and message body are required");
      return;
    }
    const { id, createdAt, updatedAt, ...data } = draft;
    const saved = saveWhatsAppTemplate(id, data);
    if (!saved) {
      toast.error("Could not save template");
      return;
    }
    setTemplates(loadWhatsAppTemplates());
    setDraft(saved);
    toast.success("WhatsApp template saved");
  }

  function handleDiscard() {
    if (!savedSelected) return;
    setDraft(savedSelected);
  }

  function handleCreate() {
    if (!guardDirty()) return;
    const created = createWhatsAppTemplate({
      slug: `custom_${Date.now()}`,
      name: "New WhatsApp template",
      description: "Custom WhatsApp notification",
      category: "utility",
      body: "Hi {{customer_name}},\n\n",
      status: "draft",
      variables: ["customer_name"],
    });
    setTemplates(loadWhatsAppTemplates());
    setSelectedId(created.id);
    setDraft(created);
    toast.success("Template created");
  }

  function handleDelete() {
    if (!draft) return;
    const ok = deleteWhatsAppTemplate(draft.id);
    setDeleteOpen(false);
    if (!ok) {
      toast.error("Could not delete template");
      return;
    }
    const loaded = loadWhatsAppTemplates();
    setTemplates(loaded);
    setSelectedId(loaded[0]?.id ?? null);
    toast.success("Template deleted");
  }

  function handleReset() {
    const seeded = resetWhatsAppTemplates();
    setResetOpen(false);
    setTemplates(seeded);
    setSelectedId(seeded[0]?.id ?? null);
    toast.success("WhatsApp templates reset to defaults");
  }

  return (
    <AdminPage className={cn("space-y-4 sm:space-y-5", isDirty && "pb-20 md:pb-0")}>
      <AdminPageHeader
        title="WhatsApp Templates"
        description="Design WhatsApp message templates"
        className="gap-3"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setResetOpen(true)}
            >
              <RotateCcw className="size-4" />
              <span className="sm:hidden">Reset</span>
              <span className="hidden sm:inline">Reset defaults</span>
            </Button>
            <Button variant="bakery" className="w-full sm:w-auto" onClick={handleCreate}>
              <Plus className="size-4" />
              <span className="sm:hidden">New</span>
              <span className="hidden sm:inline">New template</span>
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "all", category: "all", search: "" })}
        >
          <DashboardStatCard
            title="Total"
            value={overview.total}
            change="All templates"
            changeTone="neutral"
            icon={MessageCircle}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "active" })}
        >
          <DashboardStatCard
            title="Active"
            value={overview.active}
            change="Ready to send"
            changeTone="positive"
            icon={CheckCircle2}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "draft" })}
        >
          <DashboardStatCard
            title="Drafts"
            value={overview.drafts}
            change={overview.drafts > 0 ? "Needs review" : "None"}
            changeTone={overview.drafts > 0 ? "warning" : "positive"}
            icon={FileText}
            tone="gold"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ category: "transactional" })}
        >
          <DashboardStatCard
            title="Transactional"
            value={overview.transactional}
            change="Orders & delivery"
            changeTone="neutral"
            icon={Send}
            tone="neutral"
          />
        </button>
      </section>

      <FilterPanel>
        <div className="space-y-3">
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search name, slug, message…"
          />
          <div className="grid grid-cols-2 gap-2">
            <AdminSelect
              value={filters.status}
              onChange={(event) =>
                updateFilters({
                  status: event.target.value as WhatsAppTemplateListFilters["status"],
                })
              }
              aria-label="Status filter"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </AdminSelect>
            <AdminSelect
              value={filters.category}
              onChange={(event) =>
                updateFilters({
                  category: event.target.value as WhatsAppTemplateListFilters["category"],
                })
              }
              aria-label="Category filter"
            >
              <option value="all">All categories</option>
              <option value="transactional">Transactional</option>
              <option value="marketing">Marketing</option>
              <option value="utility">Utility</option>
              <option value="system">System</option>
            </AdminSelect>
          </div>
        </div>
      </FilterPanel>

      <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
        {/* Keep the template list in view while scrolling the long editor + preview. */}
        <Card className="shadow-sm xl:sticky xl:top-24 xl:col-span-4 xl:self-start">
          <CardHeader>
            <CardTitle className="text-base">Templates</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{filtered.length} shown</p>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <EmptyState
                icon={MessageCircle}
                title="No templates found"
                description="Try another filter or create a new template."
                className="py-10"
              />
            ) : (
              <ul className="space-y-2">
                {filtered.map((template) => (
                  <li key={template.id}>
                    <button
                      type="button"
                      onClick={() => selectTemplate(template)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                        selectedId === template.id
                          ? "border-primary/40 bg-muted"
                          : "border-border bg-card hover:border-border hover:bg-muted"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{template.name}</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">
                            {template.body}
                          </p>
                        </div>
                        <TemplateStatusBadge status={template.status} />
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        {formatTemplateCategory(template.category)} · {template.slug}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 xl:col-span-8">
          {draft ? (
            <>
              <Card className="shadow-sm">
                <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-base">Edit template</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isDirty ? "Unsaved changes" : "All changes saved"}
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setPreviewOpen(true)}
                    >
                      <Eye className="size-4" />
                      Preview
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => setTestSendOpen(true)}
                    >
                      <Send className="size-4" />
                      Test send
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto text-destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </Button>
                    {isDirty ? (
                      <Button
                        variant="outline"
                        className="hidden md:inline-flex"
                        onClick={handleDiscard}
                      >
                        Discard
                      </Button>
                    ) : null}
                    <Button
                      variant="bakery"
                      className="hidden md:inline-flex"
                      disabled={!isDirty}
                      onClick={handleSave}
                    >
                      Save changes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="wa-name">Name</Label>
                      <Input
                        id="wa-name"
                        value={draft.name}
                        onChange={(event) => patchDraft({ name: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wa-slug">Slug</Label>
                      <Input
                        id="wa-slug"
                        value={draft.slug}
                        onChange={(event) => patchDraft({ slug: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="wa-description">Description</Label>
                      <Input
                        id="wa-description"
                        value={draft.description ?? ""}
                        onChange={(event) =>
                          patchDraft({ description: event.target.value })
                        }
                        placeholder="When this message is sent"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wa-category">Category</Label>
                      <AdminSelect
                        id="wa-category"
                        value={draft.category}
                        onChange={(event) =>
                          patchDraft({
                            category: event.target
                              .value as WhatsAppTemplateRecord["category"],
                          })
                        }
                      >
                        <option value="transactional">Transactional</option>
                        <option value="marketing">Marketing</option>
                        <option value="utility">Utility</option>
                        <option value="system">System</option>
                      </AdminSelect>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wa-status">Status</Label>
                      <AdminSelect
                        id="wa-status"
                        value={draft.status}
                        onChange={(event) =>
                          patchDraft({
                            status: event.target.value as WhatsAppTemplateRecord["status"],
                          })
                        }
                      >
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                      </AdminSelect>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="wa-body">Message body</Label>
                    <textarea
                      id="wa-body"
                      className={adminTextareaClassName}
                      rows={8}
                      value={draft.body}
                      onChange={(event) => patchDraft({ body: event.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {draft.body.length} characters · keep messages concise for WhatsApp
                    </p>
                  </div>

                  <TemplateVariableChips
                    variables={draft.variables}
                    onInsert={insertVariable}
                  />
                </CardContent>
              </Card>

              <div className="hidden xl:block">
                <TemplatePreviewPanel
                  body={draft.body}
                  variables={draft.variables}
                  channel="whatsapp"
                />
              </div>
            </>
          ) : (
            <EmptyState
              icon={MessageCircle}
              title="No template selected"
              description="Choose a template from the list or create a new one."
              className="py-16"
              action={
                <Button variant="bakery" onClick={handleCreate}>
                  <Plus className="size-4" />
                  New template
                </Button>
              }
            />
          )}
        </div>
      </div>

      <WhatsAppTemplatePreviewDialog
        open={previewOpen}
        template={draft}
        onOpenChange={setPreviewOpen}
      />
      <WhatsAppTemplateTestSendDialog
        open={testSendOpen}
        template={draft}
        onOpenChange={setTestSendOpen}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete template?</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {draft
                ? `“${draft.name}” will be removed from this demo store.`
                : "This template will be removed."}
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset WhatsApp templates?</DialogTitle>
            <p className="text-sm text-muted-foreground">
              This replaces all templates with the demo defaults and discards custom edits.
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="bakery" onClick={handleReset}>
              Reset defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isDirty ? (
        <AdminMobileActionBar className="md:hidden">
          <Button variant="outline" onClick={handleDiscard}>
            Discard
          </Button>
          <Button variant="bakery" onClick={handleSave}>
            Save changes
          </Button>
        </AdminMobileActionBar>
      ) : null}
    </AdminPage>
  );
}
