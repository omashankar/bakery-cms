/**
 * A filter object as the browser sends it in a query string: empty values
 * dropped, everything else a string. The admin list screens build their
 * requests this way (`fetchListPage`), so a server page that reads the same
 * list for its first render goes through this and the same schema — the two
 * cannot ask different questions.
 */
export function asQueryParams(query: Record<string, unknown>): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params[key] = String(value);
  }
  return params;
}
