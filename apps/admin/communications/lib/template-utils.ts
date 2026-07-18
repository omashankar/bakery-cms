import type { TemplateCategory, TemplateStatus } from "@/types/communication";

export function formatTemplateCategory(category: TemplateCategory): string {
  const labels: Record<TemplateCategory, string> = {
    transactional: "Transactional",
    marketing: "Marketing",
    utility: "Utility",
    system: "System",
  };
  return labels[category];
}

export function formatTemplateStatus(status: TemplateStatus): string {
  return status === "active" ? "Active" : "Draft";
}

export function getTemplateStatusTone(
  status: TemplateStatus
): "positive" | "neutral" {
  return status === "active" ? "positive" : "neutral";
}
