const HELPFUL_MARKS_KEY = "bakery-cms-helpful-reviews";

/**
 * The reviews THIS browser has already said were helpful.
 *
 * A convenience, not a control. The count lives on the server and the endpoint
 * that raises it is public and rate-limited by address; this only stops an
 * honest reader from pressing the same button twice and wondering why nothing
 * changed. Anyone who edits their own localStorage can press it again, and that
 * is fine — the alternative is asking a reader to sign in to say "this helped".
 */
export function getHelpfulMarks(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HELPFUL_MARKS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    // Private browsing, a full quota, or something else wrote nonsense here.
    return [];
  }
}

export function rememberHelpfulMark(reviewId: string): void {
  if (typeof window === "undefined") return;
  const marks = getHelpfulMarks();
  if (marks.includes(reviewId)) return;
  try {
    window.localStorage.setItem(HELPFUL_MARKS_KEY, JSON.stringify([...marks, reviewId]));
  } catch {
    // Nothing to do: the press already reached the server, and the worst case
    // is that this browser offers the button again.
  }
}
