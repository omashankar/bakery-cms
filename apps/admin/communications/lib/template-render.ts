export function extractTemplateVariables(content: string): string[] {
  const matches = content.match(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g) ?? [];
  const variables = matches.map((match) => match.replace(/\{\{|\}\}/g, "").trim());
  return [...new Set(variables)];
}

export function renderTemplate(
  content: string,
  variables: Record<string, string>
): string {
  return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return variables[key] ?? `{{${key}}}`;
  });
}

export function mergeTemplateVariables(
  declared: string[],
  contentParts: string[]
): string[] {
  const discovered = contentParts.flatMap((part) => extractTemplateVariables(part));
  return [...new Set([...declared, ...discovered])].sort();
}
