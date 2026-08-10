import type {
  TemplateCategory,
  TemplateStatus,
  WhatsAppTemplateRecord,
} from "@/types/communication";

export type WhatsAppTemplateStatusFilter = TemplateStatus | "all";
export type WhatsAppTemplateCategoryFilter = TemplateCategory | "all";

export interface WhatsAppTemplateListFilters {
  search: string;
  status: WhatsAppTemplateStatusFilter;
  category: WhatsAppTemplateCategoryFilter;
}

export const defaultWhatsAppTemplateFilters: WhatsAppTemplateListFilters = {
  search: "",
  status: "all",
  category: "all",
};

export interface WhatsAppTemplateOverview {
  total: number;
  active: number;
  drafts: number;
  transactional: number;
  /** Active, linked to a Meta template, and approved by Meta. */
  sendable: number;
}

export const EMPTY_WHATSAPP_TEMPLATE_OVERVIEW: WhatsAppTemplateOverview = {
  total: 0,
  active: 0,
  drafts: 0,
  transactional: 0,
  sendable: 0,
};

/**
 * Everything a template needs before a customer can receive it.
 *
 * "Active" is the shop's own decision and says nothing about whether the message
 * can leave the building. A template can be published, carefully worded, and
 * completely unsendable because Meta has never seen it — which is what the stat
 * card counting actives as "Ready to send" used to imply it had ruled out.
 */
export function isSendable(template: WhatsAppTemplateRecord): boolean {
  return (
    template.status === "active" &&
    Boolean(template.metaName?.trim()) &&
    template.approval === "approved"
  );
}

/**
 * Placeholders Meta expects that the mapping does not fill.
 *
 * Counted over the SLOT COUNT rather than over the mapping, so a template Meta
 * says takes three parameters while the shop has mapped two is caught. That
 * shorter-array case is the one worth catching: Meta rejects a message whose
 * parameter count does not match the approved body, and the error names no
 * parameter — so it surfaces as an order that quietly received no message and a
 * log line nobody is reading, when the count was knowable while the admin was
 * still looking at the form.
 */
export function countUnfilledSlots(
  slots: number,
  parameters: readonly string[] | undefined,
): number {
  return Array.from({ length: Math.max(0, slots) }, (_, index) => parameters?.[index]).filter(
    (value) => !value?.trim(),
  ).length;
}

export function getWhatsAppTemplateOverview(
  templates: WhatsAppTemplateRecord[]
): WhatsAppTemplateOverview {
  return templates.reduce<WhatsAppTemplateOverview>(
    (acc, template) => {
      acc.total += 1;
      if (template.status === "active") acc.active += 1;
      else acc.drafts += 1;
      if (template.category === "transactional") acc.transactional += 1;
      if (isSendable(template)) acc.sendable += 1;
      return acc;
    },
    { ...EMPTY_WHATSAPP_TEMPLATE_OVERVIEW }
  );
}

export function filterWhatsAppTemplates(
  templates: WhatsAppTemplateRecord[],
  filters: WhatsAppTemplateListFilters
): WhatsAppTemplateRecord[] {
  const query = filters.search.trim().toLowerCase();

  return templates.filter((template) => {
    if (filters.status !== "all" && template.status !== filters.status) return false;
    if (filters.category !== "all" && template.category !== filters.category) {
      return false;
    }
    if (!query) return true;

    const haystack = [
      template.name,
      template.slug,
      template.body,
      template.description ?? "",
      template.category,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}

/**
 * Parameters mapped BEYOND what Meta's approved body takes.
 *
 * `countUnfilledSlots` is one-directional by construction: it walks
 * `Array.from({ length: slots })`, so with two slots and three parameters it
 * counts zero blanks and the amber alert never renders. Meta rejects a send
 * whose parameter count does not match the approved body, so the shop's
 * confirmations stopped going out with nothing on the screen to explain it —
 * and with `parameterCount: 0` the panel positively stated "This template takes
 * no variables" while three parameters sat in the record.
 *
 * The server cannot catch it either: `parameterCount` comes from Meta and is
 * only known here, on the screen that does the mapping.
 */
export function countSurplusParameters(
  slots: number,
  parameters: readonly string[] | undefined,
): number {
  const mapped = (parameters ?? []).filter((value) => value?.trim()).length;
  return Math.max(0, mapped - Math.max(0, slots));
}
