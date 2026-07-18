/** Trigger browser print after the invoice DOM is ready; clear after the dialog closes. */
export function runBrowserPrint(onDone?: () => void): () => void {
  let settled = false;

  const printTimer = window.setTimeout(() => {
    window.print();
  }, 80);

  let fallbackTimer = 0;

  function finish() {
    if (settled) return;
    settled = true;
    window.clearTimeout(printTimer);
    window.clearTimeout(fallbackTimer);
    window.removeEventListener("afterprint", finish);
    onDone?.();
  }

  window.addEventListener("afterprint", finish);
  fallbackTimer = window.setTimeout(finish, 60_000);

  return () => {
    window.clearTimeout(printTimer);
    window.clearTimeout(fallbackTimer);
    window.removeEventListener("afterprint", finish);
  };
}
