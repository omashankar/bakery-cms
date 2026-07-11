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
}

export const EMPTY_WHATSAPP_TEMPLATE_OVERVIEW: WhatsAppTemplateOverview = {
  total: 0,
  active: 0,
  drafts: 0,
  transactional: 0,
};

export function getWhatsAppTemplateOverview(
  templates: WhatsAppTemplateRecord[]
): WhatsAppTemplateOverview {
  return templates.reduce<WhatsAppTemplateOverview>(
    (acc, template) => {
      acc.total += 1;
      if (template.status === "active") acc.active += 1;
      else acc.drafts += 1;
      if (template.category === "transactional") acc.transactional += 1;
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
