"use client";

import { useEffect } from "react";
import { hydrateOnce } from "@/lib/hydrate-once";

import { fetchMediaFiles, fetchMediaFolders, mediaHydration } from "./media-api";
import { persistServerMedia } from "./media-repository";
import { persistServerMediaFolders } from "./media-folders";

/**
 * Hydrates the media library (files + folders) from the server once on entering
 * the admin. Files skip an empty server list (so the local seed survives the
 * first run); folders come seeded from the server. Every save dual-writes.
 */
export function useMediaServerSync(): void {
  useEffect(() => {
    // Keyed, not cancelled: the Media Library page mounts this for itself
    // rather than waiting out the layout's deferral, and the later caller joins
    // this read instead of issuing another.
    void hydrateOnce("media", async () => {
      const [files, folders] = await Promise.all([fetchMediaFiles(), fetchMediaFolders()]);
      /**
       * FOLDERS FIRST.
       *
       * `persistServerMedia` dispatches MEDIA_UPDATED_EVENT synchronously, and
       * the media page's listener calls `refresh()`, which re-reads BOTH files
       * and folders. Writing files first therefore fired that read while
       * localStorage still held the pre-hydration folder list — and
       * `persistServerMediaFolders` dispatches nothing of its own, so nothing
       * ever re-read them. The sidebar sat on the local seed for the rest of
       * the session while the files beside it were the server's.
       */
      if (folders) persistServerMediaFolders(folders);
      if (files) persistServerMedia(files);

      // Only NOW may a replace-all mutation send the local list — before this,
      // that list is whatever this browser happened to hold.
      if (files && folders) mediaHydration.markSettled();
    });
  }, []);
}
