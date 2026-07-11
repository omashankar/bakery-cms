import type { Metadata } from "next";
import { PageFormPage } from "@/features/admin/pages";

export const metadata: Metadata = {
  title: "Edit Page",
  description: "Edit static page content and SEO.",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PageFormPage mode="edit" pageId={id} />;
}
