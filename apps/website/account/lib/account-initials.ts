/**
 * "Asha Menon" → "AM". Its own module so a trigger button can show it without
 * importing the dropdown it opens.
 */
export function getAccountInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
