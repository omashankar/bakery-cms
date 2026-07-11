import type { Metadata } from "next";
import { CmsPageView } from "@/features/storefront/components/cms-page-view";

export const metadata: Metadata = {
  title: "Page",
  description: "Static content page.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <CmsPageView slug={slug} />;
}
