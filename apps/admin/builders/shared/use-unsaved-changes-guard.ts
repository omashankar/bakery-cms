"use client";

import { useEffect } from "react";

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
 * NOT caught, and worth being honest about: navigation issued from code rather
 * than from a link. The admin header's command palette (Ctrl+K) and its logout
 * dialog both call `router.push`, which dispatches no click — those two exits
 * still lose unsaved work. Closing them means the NavigationBlocker context the
 * Next docs describe, which is a change to the whole admin shell rather than to
 * the builder.
 *
 * Also not caught, on purpose: anything inside the builder's own preview panel.
 * The preview renders real storefront sections, which are full of links — a
 * product card is a `<Link>` stretched over the whole card — so without that
 * exemption an admin clicking a card in their own preview got a leave-the-page
 * prompt, and enough of those in a row make a browser suppress dialogs
 * altogether, at which point `confirm()` returns false and this guard would
 * silently deaden every link in the admin.
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

      // The builder's own preview is not a way out of the builder — the panel
      // stops those clicks navigating at all.
      if (anchor.closest("[data-builder-preview]")) return;

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
