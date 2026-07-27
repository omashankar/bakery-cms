"use client";

import { useEffect } from "react";

import { fetchMediaFiles, fetchMediaFolders } from "./media-api";
import { persistServerMedia } from "./media-repository";
import { persistServerMediaFolders } from "./media-folders";

/**
 * Hydrates the media library (files + folders) from the server once on entering
 * the admin. Files skip an empty server list (so the local seed survives the
 * first run); folders come seeded from the server. Every save dual-writes.
 */
export function useMediaServerSync(): void {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [files, folders] = await Promise.all([fetchMediaFiles(), fetchMediaFolders()]);
      if (cancelled) return;
      if (files) persistServerMedia(files);
      if (folders) persistServerMediaFolders(folders);
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
