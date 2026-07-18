import { Badge } from "@/components/ui/badge";
import type { GlobalSeoSettings, SeoRouteEntry } from "@/types/seo";
import { buildCanonicalUrl, resolveRouteTitle } from "@/features/seo/lib/seo-metadata";

interface SeoSerpPreviewProps {
  entry: Pick<SeoRouteEntry, "path" | "metaTitle" | "metaDescription">;
  global: GlobalSeoSettings;
  noIndex?: boolean;
}

export function SeoSerpPreview({ entry, global, noIndex = false }: SeoSerpPreviewProps) {
  const title = resolveRouteTitle(
    {
      ...entry,
      id: "",
      routeKey: "",
      label: "",
      metaKeywords: [],
      noIndex: false,
      noFollow: false,
      updatedAt: "",
    },
    global
  );
  const url = buildCanonicalUrl(entry.path, global);
  const description = entry.metaDescription || global.defaultDescription;

  return (
    <div className="space-y-3">
      {/* Light island — a SERP mockup is always light, never admin dark tokens. */}
      <div
        className="storefront-light rounded-xl border border-border bg-background p-4 text-foreground shadow-sm"
        data-storefront-theme="light"
        style={{ colorScheme: "light" }}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">Google preview</p>
          {noIndex || !global.allowIndexing ? (
            <Badge variant="outline">Not indexed</Badge>
          ) : (
            <Badge variant="success">Indexable</Badge>
          )}
        </div>
        <div className="mt-3 space-y-1">
          <p className="line-clamp-2 text-sm text-[#1a0dab]">{title || "Page title"}</p>
          <p className="truncate text-xs text-[#006621]">{url}</p>
          <p className="line-clamp-2 text-sm text-[#4d5156]">
            {description || "Meta description preview"}
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Title suffix and site name from global SEO are applied in this preview.
      </p>
    </div>
  );
}
