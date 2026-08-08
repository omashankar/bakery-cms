/**
 * What a builder is allowed to store.
 *
 * The only check either endpoint made was `Array.isArray(body.sections)`. Every
 * other property went to Mongo unread, and the storefront renders those sections
 * on the server: a section arriving without `content` is a `content.title` on a
 * live page, which throws during the render. There is no error boundary under the
 * storefront, so /store answers Next's 500 page — to every visitor, until an
 * admin notices and fixes it. A shape check at the write is the cheap end of that.
 *
 * Deliberately NOT validated: `type` against the registry. A type retired from
 * the registry still exists in layouts saved before it went, and rejecting those
 * would make an existing page unsavable — the renderers already fall through to
 * `null` for a type they do not know. And the contents of `content`, which is
 * free-form by design; what matters is that it is an object of primitives rather
 * than something a renderer will choke on.
 */

/** Generous: the homepage registry ships 19 sections and duplicates are allowed. */
export const MAX_SECTIONS = 200;

const BACKGROUNDS = new Set(["white", "cream"]);

export interface SectionPayloadIssue {
  index: number;
  problem: string;
}

export type SectionPayloadResult<T> =
  | { ok: true; sections: T[] }
  | { ok: false; error: string };

function describe(issues: SectionPayloadIssue[]): string {
  const first = issues
    .slice(0, 3)
    .map((issue) => `section ${issue.index}: ${issue.problem}`)
    .join("; ");
  return issues.length > 3
    ? `${first}; and ${issues.length - 3} more`
    : first;
}

function contentIsUsable(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).every(
    (entry) =>
      typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean",
  );
}

export function parseSectionsPayload<T>(value: unknown): SectionPayloadResult<T> {
  if (!Array.isArray(value)) return { ok: false, error: "sections array is required" };
  if (value.length > MAX_SECTIONS) {
    return { ok: false, error: `a layout cannot hold more than ${MAX_SECTIONS} sections` };
  }

  const issues: SectionPayloadIssue[] = [];
  const seen = new Set<string>();

  value.forEach((raw, index) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      issues.push({ index, problem: "is not an object" });
      return;
    }
    const section = raw as Record<string, unknown>;

    if (typeof section.instanceId !== "string" || !section.instanceId.trim()) {
      issues.push({ index, problem: "has no instanceId" });
    } else if (seen.has(section.instanceId)) {
      // Two sections sharing an id makes the editor edit both at once and the
      // React key collide.
      issues.push({ index, problem: `repeats instanceId "${section.instanceId}"` });
    } else {
      seen.add(section.instanceId);
    }

    if (typeof section.type !== "string" || !section.type.trim()) {
      issues.push({ index, problem: "has no type" });
    }
    if (typeof section.order !== "number" || !Number.isFinite(section.order)) {
      issues.push({ index, problem: "has no numeric order" });
    }
    if (typeof section.isVisible !== "boolean") {
      // Not coerced: `undefined` reads as hidden in one place and visible in
      // another, so a section could be live on the storefront and greyed out in
      // the builder at the same time.
      issues.push({ index, problem: "has no isVisible flag" });
    }
    if (typeof section.background !== "string" || !BACKGROUNDS.has(section.background)) {
      issues.push({ index, problem: "has an unknown background" });
    }
    if (!contentIsUsable(section.content)) {
      issues.push({ index, problem: "has no usable content object" });
    }
  });

  if (issues.length) return { ok: false, error: describe(issues) };
  return { ok: true, sections: value as T[] };
}
