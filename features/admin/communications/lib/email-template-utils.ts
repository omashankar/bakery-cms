import type {
  EmailTemplateRecord,
  TemplateCategory,
  TemplateStatus,
} from "@/types/communication";

export type EmailTemplateStatusFilter = TemplateStatus | "all";
export type EmailTemplateCategoryFilter = TemplateCategory | "all";

export interface EmailTemplateListFilters {
  search: string;
  status: EmailTemplateStatusFilter;
  category: EmailTemplateCategoryFilter;
}

export const defaultEmailTemplateFilters: EmailTemplateListFilters = {
  search: "",
  status: "all",
  category: "all",
};

export interface EmailTemplateOverview {
  total: number;
  active: number;
  drafts: number;
  transactional: number;
}

export const EMPTY_EMAIL_TEMPLATE_OVERVIEW: EmailTemplateOverview = {
  total: 0,
  active: 0,
  drafts: 0,
  transactional: 0,
};

export function getEmailTemplateOverview(
  templates: EmailTemplateRecord[]
): EmailTemplateOverview {
  return templates.reduce<EmailTemplateOverview>(
    (acc, template) => {
      acc.total += 1;
      if (template.status === "active") acc.active += 1;
      else acc.drafts += 1;
      if (template.category === "transactional") acc.transactional += 1;
      return acc;
    },
    { ...EMPTY_EMAIL_TEMPLATE_OVERVIEW }
  );
}

export function filterEmailTemplates(
  templates: EmailTemplateRecord[],
  filters: EmailTemplateListFilters
): EmailTemplateRecord[] {
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
      template.subject,
      template.description ?? "",
      template.category,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(query);
  });
}
