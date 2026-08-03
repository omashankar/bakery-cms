"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Eye,
  FileText,
  Mail,
  Plus,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { reportWrite } from "@/apps/admin/lib/report-write";
import { AdminMobileActionBar, AdminPage, AdminPageHeader } from "@/apps/admin/components";
import { AdminSelect, adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { DashboardStatCard } from "@/apps/admin/dashboard/components/dashboard-stat-card";
import { EmailTemplatePreviewDialog } from "@/apps/admin/communications/components/email-template-preview-dialog";
import { EmailTemplateTestSendDialog } from "@/apps/admin/communications/components/email-template-test-send-dialog";
import { TemplatePreviewPanel } from "@/apps/admin/communications/components/template-preview-panel";
import { TemplateStatusBadge } from "@/apps/admin/communications/components/template-status-badge";
import { TemplateVariableChips } from "@/apps/admin/communications/components/template-variable-chips";
import {
  isSendableSlug,
  offContractVariables,
  validateSlug,
} from "@/features/communications/lib/template-contract";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  EMAIL_TEMPLATES_UPDATED_EVENT,
  loadEmailTemplates,
  resetEmailTemplates,
  saveEmailTemplate,
} from "@/apps/admin/communications/lib/email-templates-repository";
import { ensureCommunicationsHydrated } from "@/apps/admin/communications/lib/use-communications-server-sync";
import {
  SettingsFormGate,
  SettingsHydrationNotice,
} from "@/apps/admin/settings/components/settings-field-error";
import {
  defaultEmailTemplateFilters,
  EMPTY_EMAIL_TEMPLATE_OVERVIEW,
  filterEmailTemplates,
  getEmailTemplateOverview,
  type EmailTemplateListFilters,
} from "@/apps/admin/communications/lib/email-template-utils";
import { deriveTemplateVariables } from "@/lib/template-render";
import { formatTemplateCategory } from "@/apps/admin/communications/lib/template-utils";
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
import type { EmailTemplateRecord } from "@/types/communication";
import { cn } from "@/lib/utils";

/**
 * Whether the editor's copy differs from the one it was loaded from.
 *
 * `updatedAt` and `createdAt` are excluded on BOTH sides. The first attempt
 * excluded only `updatedAt` here while `isDirty` excluded both, so a record
 * differing solely in `createdAt` — which the client seed stamps at page-load
 * time and the server's does not — was "edited" to the effect and "clean" to
 * the header at the same time: the draft pinned forever under an "All changes
 * saved" label describing a copy that was not the saved one.
 */
function isEdited(
  a: EmailTemplateRecord | null,
  b: EmailTemplateRecord | null,
): boolean {
  if (!a || !b) return false;
  const strip = (t: EmailTemplateRecord) =>
    JSON.stringify({ ...t, updatedAt: undefined, createdAt: undefined });
  return strip(a) !== strip(b);
}

export function EmailTemplatesAdminPage() {
  const [mounted, setMounted] = useState(false);
  // Real hydration, not "has this component rendered". The form used to be
  // fully editable over the DEMO SEED that `loadEmailTemplates` plants when the
  // cache is empty, with `mounted` gating nothing but the stat cards.
  const [hydration, setHydration] = useState<"pending" | "ready" | "unavailable">("pending");
  const [templates, setTemplates] = useState<EmailTemplateRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmailTemplateRecord | null>(null);
  /**
   * The saved copy the draft was derived from.
   *
   * Without it there is no way to tell an edit from a baseline that moved.
   * The first attempt at preserving edits diffed the draft against the NEW
   * baseline — which is the same record the effect was about to adopt — so
   * server hydration read as "the admin is typing" and the PRE-hydration
   * draft was kept. On a cold cache that draft is the demo seed, so a page
   * the admin had only just opened announced "Unsaved changes", refused to
   * let them switch template, and offered to Save the seed over the shop's
   * real copy. Strictly worse than the clobber it replaced.
   */
  const [draftOrigin, setDraftOrigin] = useState<EmailTemplateRecord | null>(null);
  // Read inside the updater below, which must not re-run on every keystroke.
  const draftOriginRef = useRef<EmailTemplateRecord | null>(null);
  const [filters, setFilters] = useState<EmailTemplateListFilters>(defaultEmailTemplateFilters);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [testSendOpen, setTestSendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    function refresh() {
      const loaded = loadEmailTemplates();
      setTemplates(loaded);
      setMounted(true);
      setSelectedId((current) => {
        if (current && loaded.some((template) => template.id === current)) return current;
        return loaded[0]?.id ?? null;
      });
    }

    let cancelled = false;
    refresh();
    window.addEventListener(EMAIL_TEMPLATES_UPDATED_EVENT, refresh);

    // Ask for the server's copy rather than waiting on the layout effect to:
    // it never re-runs after an in-app login, and the form must adopt what
    // arrives BEFORE it unlocks or the admin edits the seed.
    void ensureCommunicationsHydrated().then((settled) => {
      if (cancelled) return;
      if (settled.email) refresh();
      setHydration(settled.email ? "ready" : "unavailable");
    });

    return () => {
      cancelled = true;
      window.removeEventListener(EMAIL_TEMPLATES_UPDATED_EVENT, refresh);
    };
  }, []);

  const overview = useMemo(
    () => (mounted ? getEmailTemplateOverview(templates) : EMPTY_EMAIL_TEMPLATE_OVERVIEW),
    [templates, mounted]
  );

  const filtered = useMemo(
    () => filterEmailTemplates(templates, filters),
    [templates, filters]
  );

  const savedSelected = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [templates, selectedId]
  );

  useEffect(() => {
    if (!selectedId) {
      setDraft(null);
      setDraftOrigin(null);
      return;
    }
    const next = templates.find((template) => template.id === selectedId) ?? null;
    // Never over an edit in progress.
    //
    // This ran on EVERY change to `templates` — including server hydration and
    // any save from another tab — and replaced the editor's contents outright.
    // An admin part-way through rewriting a subject line lost it with no
    // warning and nothing on screen to say why. Comparing against the saved
    // copy is how the shared settings form decides the same question.
    setDraft((current) => {
      // A different template, or nothing open: adopt outright.
      if (!current || current.id !== selectedId) {
        setDraftOrigin(next);
        return next;
      }
      // Untouched since it was loaded — take the server's newer copy.
      if (!isEdited(current, draftOriginRef.current)) {
        setDraftOrigin(next);
        return next;
      }
      // Genuinely mid-edit. Keep what the admin typed; `isDirty` below
      // compares against the new baseline, so the header and Save button
      // describe the difference that actually matters.
      return current;
    });
  }, [selectedId, templates]);

  useEffect(() => {
    draftOriginRef.current = draftOrigin;
  }, [draftOrigin]);

  /**
   * The slug is the KEY a sender matches on, so it is checked live rather
   * than at save time — an admin who types over `order_confirmation` should
   * be told immediately, not after the copy customers receive has changed.
   */
  const slugProblem = draft
    ? validateSlug(
        draft.slug,
        savedSelected?.slug ?? draft.slug,
        templates.filter((t) => t.id !== draft.id).map((t) => t.slug),
      )
    : null;
  const slugLocked = Boolean(draft && isSendableSlug(savedSelected?.slug ?? draft.slug));

  /**
   * Shown BEFORE the save is attempted, not only when it is refused.
   *
   * A stored template can carry one of these from before the rule existed —
   * the WhatsApp order confirmation this project shipped did — so an admin
   * editing something unrelated would press Save and be refused over a line
   * they never wrote. The fix is one edit, and it is only obvious if the
   * offending variable is named next to the body.
   */
  const stray = draft
    ? offContractVariables(draft.slug, draft.variables, "email")
    : [];
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

  function updateFilters(patch: Partial<EmailTemplateListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
  }

  function guardDirty(): boolean {
    if (!isDirty) return true;
    toast.error("Save or discard changes first");
    return false;
  }

  function selectTemplate(template: EmailTemplateRecord) {
    if (template.id === selectedId) return;
    if (!guardDirty()) return;
    setSelectedId(template.id);
  }

  function patchDraft(patch: Partial<EmailTemplateRecord>) {
    if (!draft) return;
    setDraft({
      ...draft,
      ...patch,
      // DERIVED from the content, not accumulated onto it. See
      // `deriveTemplateVariables` — a union here makes a variable unremovable,
      // which locked Save with an on-screen instruction that could not work.
      variables: deriveTemplateVariables([
        patch.subject ?? draft.subject,
        patch.previewText ?? draft.previewText ?? "",
        patch.body ?? draft.body,
      ]),
    });
  }

  function insertVariable(variable: string) {
    if (!draft) return;
    patchDraft({ body: `${draft.body}{{${variable}}}` });
  }

  async function handleSave() {
    if (!draft) return;
    if (!draft.name.trim() || !draft.slug.trim() || !draft.subject.trim()) {
      toast.error("Name, slug, and subject are required");
      return;
    }
    /**
     * A variable this template's sender will never supply.
     *
     * The contract used to govern only which chips were OFFERED, so a
     * hand-typed one sailed straight through: the live preview rendered it,
     * the test send to the admin's own inbox rendered it — both filled from
     * one flat table holding every variable any template might use — and the
     * customer received the literal braces, because renderTemplate leaves an
     * unresolved key exactly as written.
     *
     * Refused rather than warned about, for the same reason a bad slug is:
     * the damage lands on a customer, not on this screen.
     */
    if (stray.length) {
      toast.error("Remove variables nothing will fill", {
        description: `${stray.map((name) => `{{${name}}}`).join(", ")} would reach the customer exactly as written.`,
      });
      return;
    }

    if (slugProblem) {
      toast.error("Fix the slug first", { description: slugProblem.message });
      return;
    }
    const { id, createdAt, updatedAt, ...data } = draft;
    const { value: saved, persisted } = await saveEmailTemplate(id, data);
    if (!saved) {
      toast.error("Could not save template");
      return;
    }
    // The store ROLLS BACK a refused write, so the local list is the
    // server's again — re-read it, and only re-baseline the editor when the
    // server actually took the change. Adopting `saved` regardless left the
    // header reading "All changes saved" with Save greyed out, for an edit
    // that existed nowhere.
    setTemplates(loadEmailTemplates());
    if (persisted) {
      setDraft(saved);
      setDraftOrigin(saved);
    }
    reportWrite(persisted, "Email template saved", {
      failure: "Email template was not saved — the server rejected it",
    });
  }

  function handleDiscard() {
    if (!savedSelected) return;
    setDraft(savedSelected);
    setDraftOrigin(savedSelected);
  }

  async function handleCreate() {
    if (!guardDirty()) return;
    const { value: created, persisted } = await createEmailTemplate({
      slug: `custom_${Date.now()}`,
      name: "New email template",
      description: "Custom email template",
      category: "marketing",
      subject: "Hello {{customer_name}}",
      previewText: "Message from {{store_name}}",
      body: "Hi {{customer_name}},\n\n",
      status: "draft",
      variables: ["customer_name", "store_name"],
    });
    setTemplates(loadEmailTemplates());
    // A refused create rolled back too — there is no such template to
    // select, and selecting it left the editor pointed at a record that
    // existed in neither the list nor the server.
    if (persisted) {
      setSelectedId(created.id);
      setDraft(created);
      setDraftOrigin(created);
    }
    reportWrite(persisted, "Template created", {
      failure: "Template was not created — the server rejected it",
    });
  }

  async function handleDelete() {
    if (!draft) return;
    const { value: ok, persisted } = await deleteEmailTemplate(draft.id);
    setDeleteOpen(false);
    if (!ok) {
      toast.error("Could not delete template");
      return;
    }
    const loaded = loadEmailTemplates();
    setTemplates(loaded);
    setSelectedId(loaded[0]?.id ?? null);
    // Same rollback rule: a refused delete put the template back, so the
    // default "on this device only" would send the admin looking for a
    // deletion that happened nowhere.
    reportWrite(persisted, "Template deleted", {
      failure: "Template was not deleted — the server rejected it",
    });
  }

  async function handleReset() {
    const { value: seeded, persisted } = await resetEmailTemplates();
    setResetOpen(false);
    // Re-read rather than trusting `seeded`: a refused reset is rolled back,
    // and showing the demo set anyway told the admin their templates were
    // gone when the server still had them.
    setTemplates(loadEmailTemplates());
    if (persisted) setSelectedId(seeded[0]?.id ?? null);
    reportWrite(persisted, "Email templates reset to defaults", {
      failure: "Reset failed — the server kept your templates",
    });
  }

  return (
    <AdminPage className={cn("space-y-4 sm:space-y-5", isDirty && "pb-20 md:pb-0")}>
      <AdminPageHeader
        title="Email Templates"
        description="Design transactional and marketing emails"
        className="gap-3"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => setResetOpen(true)}
              disabled={hydration !== "ready"}
            >
              <RotateCcw className="size-4" />
              <span className="sm:hidden">Reset</span>
              <span className="hidden sm:inline">Reset defaults</span>
            </Button>
            <Button variant="bakery" className="w-full sm:w-auto" onClick={() => void handleCreate()} disabled={hydration !== "ready"}>
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
            icon={Mail}
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
            change="Orders & account"
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
            placeholder="Search name, slug, subject…"
          />
          <div className="grid grid-cols-2 gap-2">
            <AdminSelect
              value={filters.status}
              onChange={(event) =>
                updateFilters({
                  status: event.target.value as EmailTemplateListFilters["status"],
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
                  category: event.target.value as EmailTemplateListFilters["category"],
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

      <SettingsHydrationNotice hydration={hydration} />

      <SettingsFormGate hydration={hydration}>
      <div className="grid gap-4 xl:grid-cols-12 xl:items-start">
        {/* Keep the template list in view while scrolling the long editor + preview. */}
        <Card className="shadow-sm xl:sticky xl:top-24 xl:col-span-4 xl:self-start">
          <CardHeader>
            <CardTitle className="text-base">Templates</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtered.length} shown
            </p>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <EmptyState
                icon={Mail}
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
                          <p className="truncate text-xs text-muted-foreground">
                            {template.subject}
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
                      disabled={!isDirty || hydration !== "ready" || Boolean(slugProblem) || stray.length > 0}
                      onClick={() => void handleSave()}
                    >
                      Save changes
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="template-name">Name</Label>
                      <Input
                        id="template-name"
                        value={draft.name}
                        onChange={(event) => patchDraft({ name: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="template-slug">Slug</Label>
                      <Input
                        id="template-slug"
                        value={draft.slug}
                        onChange={(event) => patchDraft({ slug: event.target.value })}
                        // Read-only for the templates the shop actually sends.
                        // Renaming one does not break loudly: `findTemplate`
                        // simply stops matching and the hardcoded fallback goes
                        // out instead, so the admin's own wording quietly stops
                        // reaching anyone.
                        readOnly={slugLocked}
                        aria-invalid={Boolean(slugProblem)}
                        className={slugLocked ? "bg-muted" : undefined}
                      />
                      {slugLocked ? (
                        <p className="text-xs text-muted-foreground">
                          This email is sent by the shop — its slug is fixed. The wording
                          above is yours to change.
                        </p>
                      ) : slugProblem ? (
                        <p className="text-xs text-destructive" role="alert">
                          {slugProblem.message}
                        </p>
                      ) : null}
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="template-description">Description</Label>
                      <Input
                        id="template-description"
                        value={draft.description ?? ""}
                        onChange={(event) =>
                          patchDraft({ description: event.target.value })
                        }
                        placeholder="When this email is sent"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="template-category">Category</Label>
                      <AdminSelect
                        id="template-category"
                        value={draft.category}
                        onChange={(event) =>
                          patchDraft({
                            category: event.target
                              .value as EmailTemplateRecord["category"],
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
                      <Label htmlFor="template-status">Status</Label>
                      <AdminSelect
                        id="template-status"
                        value={draft.status}
                        onChange={(event) =>
                          patchDraft({
                            status: event.target.value as EmailTemplateRecord["status"],
                          })
                        }
                      >
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                      </AdminSelect>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-subject">Subject</Label>
                    <Input
                      id="template-subject"
                      value={draft.subject}
                      onChange={(event) => patchDraft({ subject: event.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-preview">Preview text</Label>
                    <Input
                      id="template-preview"
                      value={draft.previewText ?? ""}
                      onChange={(event) =>
                        patchDraft({ previewText: event.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-body">Body</Label>
                    <textarea
                      id="template-body"
                      className={adminTextareaClassName}
                      rows={10}
                      value={draft.body}
                      onChange={(event) => patchDraft({ body: event.target.value })}
                    />
                  </div>

                  {stray.length ? (
                    <p
                      className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100"
                      role="alert"
                    >
                      {stray.map((name) => `{{${name}}}`).join(", ")} —
                      nothing supplies this when the email is sent, so the customer receives it exactly
                      as written. Remove it from the body to save.
                    </p>
                  ) : null}
                  <TemplateVariableChips
                    variables={draft.variables}
                    slug={draft.slug}
                    onInsert={insertVariable}
                  />
                </CardContent>
              </Card>

              <div className="hidden xl:block">
                <TemplatePreviewPanel
                  subject={draft.subject}
                  previewText={draft.previewText}
                  body={draft.body}
                  variables={draft.variables}
                  slug={draft.slug}
                  channel="email"
                />
              </div>
            </>
          ) : (
            <EmptyState
              icon={Mail}
              title="No template selected"
              description="Choose a template from the list or create a new one."
              className="py-16"
              action={
                <Button variant="bakery" onClick={() => void handleCreate()} disabled={hydration !== "ready"}>
                  <Plus className="size-4" />
                  New template
                </Button>
              }
            />
          )}
        </div>
      </div>
      </SettingsFormGate>

      <EmailTemplatePreviewDialog
        open={previewOpen}
        template={draft}
        onOpenChange={setPreviewOpen}
      />
      <EmailTemplateTestSendDialog
        open={testSendOpen}
        /*
          The SAVED copy, because that is what the server sends. The dialog
          previews what it is given and the endpoint reads the stored row, so
          passing the draft showed the admin their unsaved edits above a
          button that delivered something else.
        */
        template={savedSelected}
        hasUnsavedChanges={isDirty}
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
            <Button variant="destructive" onClick={() => void handleDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset email templates?</DialogTitle>
            <p className="text-sm text-muted-foreground">
              This replaces all templates with the demo defaults and discards custom edits.
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="bakery" onClick={() => void handleReset()}>
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
          <Button
            variant="bakery"
            onClick={() => void handleSave()}
            // The desktop Save was gated on hydration and this one was not, so
            // the whole guard was one narrow viewport away from irrelevant.
            disabled={hydration !== "ready"}
          >
            Save changes
          </Button>
        </AdminMobileActionBar>
      ) : null}
    </AdminPage>
  );
}
