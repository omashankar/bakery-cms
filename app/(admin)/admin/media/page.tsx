import type { Metadata } from "next";
import { MediaLibraryPage } from "@/features/admin/media";

export const metadata: Metadata = {
  title: "Media Library",
  description: "Images, videos, folders, and banner manager.",
};

export default function Page() {
  return <MediaLibraryPage />;
}
