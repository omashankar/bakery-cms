/**
 * Reading a section's LIST fields — the rows an admin types into a band.
 *
 * Its own module, apart from the section registry, because the bands that run
 * in the browser need these four and nothing else: importing them from the
 * registry put every section definition (18 KB) into the homepage's bundle.
 * The registry re-exports them, so its other readers are unchanged.
 */

/**
 * A TICKBOX IN A LIST ROW, read back.
 *
 * `parseListField` below coerces every value in a row to a string, because
 * a row is admin-typed and the rest of the fields genuinely are strings. So
 * a tickbox that was OFF comes back as the string "false" — which is five
 * characters long and therefore truthy. A card explicitly marked NOT wide
 * was rendering wide, and the only way to make it narrow again was to clear
 * the field rather than untick it.
 *
 * Anything a person would read as off is off: an empty value, "false", "0",
 * "no", "off". Everything else is on, so a row saved before this existed
 * with a hand-typed "true" or "yes" still means what it said.
 */
export function rowFlag(value: string | undefined): boolean {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return false;
  return !(["false", "0", "no", "off"].includes(text));
}

export function parseListField(
  content: Record<string, string | number | boolean>,
  key: string,
): Record<string, string>[] {
  const raw = content[key];
  if (typeof raw !== "string" || !raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
      .map((row) => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(row)) {
          out[k] = typeof v === "string" ? v : v == null ? "" : String(v);
        }
        return out;
      });
  } catch {
    return [];
  }
}

/**
 * The rows a page should actually render.
 *
 * A row with nothing in any column says nothing, and an admin mid-edit leaves
 * exactly that behind. Storefront renderers filter here rather than in
 * `parseListField`, so the editor keeps its blank rows and the page does not
 * show them.
 */
/**
 * The most banners the turning strip takes.
 *
 * Named once and read twice — by the editor, which stops offering Add, and
 * by the renderer, which caps what it draws. The editor's limit is not a
 * guarantee: a document written before the cap, or by a script, can hold
 * more, and the page is what the customer sees.
 */
export const BANNER_STRIP_MAX = 3;

export function renderableRows(rows: Record<string, string>[]): Record<string, string>[] {
  return rows.filter((row) => Object.values(row).some((value) => value.trim() !== ""));
}
