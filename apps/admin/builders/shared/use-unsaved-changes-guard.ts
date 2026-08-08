"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps a ref pointing at the latest render's value.
 *
 * Used to answer "is what I just saved still what is on screen?" after an await.
 */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

const MESSAGE = "You have unsaved changes to this layout. Leave without saving?";

/**
 * Warns before unsaved builder work is thrown away.
 *
 * `beforeunload` alone was the whole guard, and it only covers reload, tab close
 * and leaving the origin. It is a document-unload event, and an App Router
 * client-side transition never unloads the document — Next 16 says so directly
 * (node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md:
 * "Instead of reloading the page, it updates the content dynamically"). Every
 * item in the admin sidebar is a `next/link`. So an admin who had reordered four
 * sections and rewritten two headlines, then clicked "Orders" to check
 * something, lost the lot: no prompt, no toast, the component simply unmounted.
 *
 * Next documents `onNavigate` on `<Link>` for this, with a
 * NavigationBlockerContext recipe (03-api-reference/02-components/link.md,
 * "Blocking navigation"). That needs every link in the admin shell to opt in.
 * This does the same job from the page that actually has something to lose: a
 * CAPTURE-phase click listener, which runs before the Link's own handler, so
 * cancelling it there cancels the navigation.
 *
 * Deliberately not caught: `router.push` from code, which dispatches no click.
 * Nothing in the builder navigates that way.
 */
export function useUnsavedChangesGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function onClickCapture(event: MouseEvent) {
      // Let the browser's own behaviour through: new tab, download, middle click.
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;

      // Preview opens in a new tab; it takes nothing away from this one.
      if (anchor.target && anchor.target !== "_self") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      // Leaving the origin unloads the document, so beforeunload already asks.
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname) return;

      if (!window.confirm(MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClickCapture, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [isDirty]);
}
