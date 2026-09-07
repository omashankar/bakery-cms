import { cache } from "react";

import { resolveLabels, type ResolvedLabels } from "@/config/business-labels";

import { getLabels } from "./settings.service";

/**
 * The shop's own word for what it sells, read on the SERVER, for chrome.
 *
 * `useBusinessLabels` covers client components. It cannot cover a `<title>`, an
 * OpenGraph description or a server component, which is why nine pages shipped
 * a `export const metadata = { title: "Cakes" }` evaluated at module load —
 * frozen wording, in the browser tab, over a page body that already resolved the
 * shop's own.
 *
 * IT FAILS OPEN, and that is the whole reason this wrapper exists rather than
 * nine calls to `getLabels`. A `generateMetadata` that throws does not degrade
 * to a plain title, it fails the render — so a database blip would turn a page
 * that has nothing to do with settings into an error. Neutral wording in a tab
 * is a cosmetic loss; a 500 on the catalog is not. The API controller keeps
 * calling `getLabels` directly, because there a failure IS the answer.
 *
 * `cache` dedupes between `generateMetadata` and the page body, which Next runs
 * as two separate calls in the same request.
 */
export const getServerLabels = cache(async (): Promise<ResolvedLabels> => {
  try {
    return await getLabels();
  } catch {
    // Through `resolveLabels` rather than field by field: it is the one place
    // a blank means "use the default", and listing the fields here meant a new
    // label was missing from the failure path until a type error found it.
    return resolveLabels({});
  }
});
