import { safeSetItem } from "@/lib/safe-storage";
const HELPFUL_MARKS_KEY = "bakery-cms-helpful-reviews";
const UNHELPFUL_MARKS_KEY = "bakery-cms-unhelpful-reviews";

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
  return readMarks(HELPFUL_MARKS_KEY);
}

export function rememberHelpfulMark(reviewId: string): void {
  rememberMark(HELPFUL_MARKS_KEY, reviewId);
}

/** The reviews this browser said were NOT helpful. The same convenience. */
export function getUnhelpfulMarks(): string[] {
  return readMarks(UNHELPFUL_MARKS_KEY);
}

export function rememberUnhelpfulMark(reviewId: string): void {
  rememberMark(UNHELPFUL_MARKS_KEY, reviewId);
}

function readMarks(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    // Private browsing, a full quota, or something else wrote nonsense here.
    return [];
  }
}

function rememberMark(key: string, reviewId: string): void {
  if (typeof window === "undefined") return;
  const marks = readMarks(key);
  if (marks.includes(reviewId)) return;
  try {
    safeSetItem(key, JSON.stringify([...marks, reviewId]));
  } catch {
    // Nothing to do: the press already reached the server, and the worst case
    // is that this browser offers the button again.
  }
}
