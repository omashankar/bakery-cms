import type { Metadata } from "next";
import { MediaLibraryPage } from "@/apps/admin/media/components/media-library-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { getFiles, getFolders } from "@/features/media/server/media.service";

export const metadata: Metadata = {
  title: "Media Library",
  description: "Images, videos, folders, and banner manager.",
};

/** The library and its folders, read with the page; see `applyServerMedia`. */
export default async function Page() {
  const initial = await whenAllowed("media.view", async () => {
    const [files, folders] = await Promise.all([getFiles(), getFolders()]);
    return JSON.parse(JSON.stringify({ files, folders }));
  });
  return <MediaLibraryPage initial={initial} />;
}
