export interface GlobalSeoSettings {
  siteName: string;
  titleSuffix: string;
  defaultDescription: string;
  defaultOgImage: string;
  defaultKeywords: string[];
  canonicalBaseUrl: string;
  allowIndexing: boolean;
  googleSiteVerification?: string;
  defaultTwitterCard: "summary" | "summary_large_image";
  twitterSite?: string;
  twitterCreator?: string;
  organizationSchemaJson?: string;
}

export interface SeoRouteEntry {
  id: string;
  routeKey: string;
  path: string;
  label: string;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string[];
  ogImage?: string;
  noIndex: boolean;
  noFollow: boolean;
  twitterCard?: "summary" | "summary_large_image";
  updatedAt: string;
}

export interface SeoStore {
  global: GlobalSeoSettings;
  routes: SeoRouteEntry[];
}

export type SeoRouteFormData = Omit<SeoRouteEntry, "id" | "updatedAt">;
