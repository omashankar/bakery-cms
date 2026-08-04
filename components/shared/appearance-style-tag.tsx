import { APPEARANCE_SSR_STYLE_ID } from "@/features/site-layout/lib/appearance-tokens";

/**
 * The shop palette on `:root`, rendered by the SERVER.
 *
 * The shell already carries these tokens as an inline style, which covers
 * everything inside it — but not what escapes it. Sonner's toaster and every
 * Base UI popup (the account menu, the auth modal, dropdowns) render through a
 * PORTAL attached to `document.body`, outside the shell entirely, so they
 * resolve `--brand-primary` and friends from `:root`. Only the client wrote
 * `:root`, so those surfaces painted the stylesheet defaults until a fetch
 * landed — and stayed that way for the whole session if it failed.
 *
 * The id is not decoration: `AppearanceThemeSync` looks for it to decide
 * whether the server has already painted this page, so it does not overwrite
 * correct server values with a cold localStorage cache.
 *
 * Nothing is emitted for an empty palette, which leaves the stylesheet defaults
 * standing — the right answer when the stored colours are unusable or the
 * database was unreachable.
 */
export function AppearanceStyleTag({ tokens }: { tokens: Record<string, string> }) {
  const entries = Object.entries(tokens);
  if (!entries.length) return null;

  // Values come from `appearanceCssVariables`, which emits only normalised hex
  // and a pixel radius — there is no path here for arbitrary text, and the
  // schema rejects a non-hex colour before it can ever be stored.
  const declarations = entries.map(([name, value]) => `${name}:${value}`).join(";");

  return (
    <style
      id={APPEARANCE_SSR_STYLE_ID}
      dangerouslySetInnerHTML={{ __html: `:root{${declarations}}` }}
    />
  );
}
