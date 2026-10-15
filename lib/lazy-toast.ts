import type { toast as sonnerToast } from "sonner";

/**
 * `toast` from sonner, loaded on the first call instead of with the page.
 *
 * sonner is ~33 KB of script, and a page that imported it statically shipped
 * all of it in its first download — the product page among them — for a
 * message only a click can raise. The `<Toaster>` that draws them is already
 * lazy (see `app-providers`), so nothing is shown any later than before: the
 * call waits for the module the Toaster loads anyway.
 *
 * Fire-and-forget only, which is how every storefront caller uses it; the
 * toast id sonner returns is not passed back.
 */
type Method = "success" | "error" | "info" | "warning" | "message";

function lazy<M extends Method>(method: M) {
  return (...args: Parameters<(typeof sonnerToast)[M]>): void => {
    void import("sonner").then(({ toast }) => {
      (toast[method] as (...a: typeof args) => unknown)(...args);
    });
  };
}

export const toast = {
  success: lazy("success"),
  error: lazy("error"),
  info: lazy("info"),
  warning: lazy("warning"),
  message: lazy("message"),
};
