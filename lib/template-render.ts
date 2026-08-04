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

/**
 * Exactly the variables the content references — nothing carried over.
 *
 * `mergeTemplateVariables` is union-only: it adds what it discovers and never
 * drops what it does not. That is right for normalising a stored record, and
 * wrong while an admin is EDITING, because it makes a variable unremovable.
 *
 * The consequence was not theoretical. The editor refuses to save a template
 * declaring a variable its sender will never supply, and tells the admin to
 * remove it from the body — the one action that could not work. Deleting the
 * text left the name in `variables`, the refusal stood, and the only way out
 * was "Reset defaults", which discards every other edit on the screen.
 */
export function deriveTemplateVariables(contentParts: string[]): string[] {
  const discovered = contentParts.flatMap((part) => extractTemplateVariables(part));
  return [...new Set(discovered)].sort();
}
