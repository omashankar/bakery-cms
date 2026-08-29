"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { reportedAsSignedOut, reportWrite } from "@/apps/admin/lib/report-write";
import { fixBrokenImageUrl } from "@/constants/demo-images";
import { shrinkImageFile } from "@/lib/images/shrink-image";
import type { MediaFile } from "@/types/media";
import { uploadMediaRequest } from "./media-api";
import { addMediaFile } from "./media-repository";
import { fileNameFromUrl, isPersistableMediaUrl } from "./media-utils";

/**
 * The largest image we will SEND, checked AFTER shrinking.
 *
 * It used to be checked against the file the admin chose, which got the target
 * user exactly backwards: a 108-megapixel phone — ordinary in this market —
 * writes 15-25 MB, so the photographs that most needed resizing were the only
 * ones refused, and the refusal named a limit the upload would never have hit.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * A sanity bound on what we will even try to decode, checked BEFORE shrinking.
 * Generous, because its only job is to stop a 500 MB file taking the tab down.
 */
export const MAX_SOURCE_BYTES = 60 * 1024 * 1024;

/**
 * Without an image host, the image is kept as base64 in localStorage AND in a
 * single Mongo document. Base64 adds about a third, browsers cap localStorage
 * near 5 MB and Mongo caps a document at 16 MB, so this has to stay small.
 */
export const MAX_INLINE_BYTES = 400 * 1024;

interface AddOptions {
  name?: string;
  size?: number;
  publicId?: string;
  mimeType?: string;
  /**
   * Suppress the per-file success toast. Adding twelve photographs at once
   * should say so once, not stack twelve notifications over the form. It never
   * suppresses a FAILURE — the batch summary reports those by counting.
   */
  quiet?: boolean;
}

interface UseMediaUploadOptions {
  /**
   * Called once per file that reaches the library. Only fires on success.
   *
   * NOT the signal to close a dialog: it fires per file, so closing here would
   * dismiss the dialog after photo one while eleven more were still uploading.
   * Wait for `uploadFiles` to resolve instead.
   */
  onAdded: (file: MediaFile) => void;
}

export interface UploadProgress {
  done: number;
  total: number;
}

export interface AddedMedia {
  file: MediaFile;
  /** Whether the SERVER took it. False means it lives only in this browser. */
  persisted: boolean;
}

export interface BatchResult {
  added: number;
  total: number;
}

/**
 * Adding images to the library, shared by every surface that can do it.
 *
 * It lived inside the Media Library's upload dialog, which is why the picker
 * used everywhere else could only offer images that were already there: adding
 * one meant leaving the form, uploading on another page, and coming back to a
 * record that had not been saved.
 */
export function useMediaUpload({ onAdded }: UseMediaUploadOptions) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  /**
   * The guard is a ref, not the state above: a second drop lands in the same
   * tick as the first, before any re-render has published `isUploading`. Both
   * entry points claim it, so a paste-import and a batch cannot overlap.
   */
  const busy = useRef(false);

  const addFromUrl = useCallback(
    async (imageUrl: string, options: AddOptions = {}): Promise<AddedMedia | null> => {
      const { name, size, publicId, mimeType, quiet } = options;

      const trimmed = imageUrl.trim();
      if (!trimmed) {
        toast.error("Enter an image URL");
        return null;
      }

      const normalizedUrl = fixBrokenImageUrl(trimmed);
      if (!isPersistableMediaUrl(normalizedUrl) && !normalizedUrl.startsWith("data:")) {
        toast.error("Enter a valid image URL");
        return null;
      }

      /**
       * A pasted link is COPIED into this shop's own account, not merely
       * recorded.
       *
       * Storing a stranger's URL means the picture lives somewhere the shop
       * does not control — it can be moved, hotlink-blocked or deleted, and
       * next/image cannot optimise a host outside remotePatterns.
       *
       * Only for a foreign https link: an upload that already went through
       * Cloudinary arrives with a publicId, and the no-host fallback arrives as
       * a data URI. Neither should be re-sent.
       */
      let sourceUrl = normalizedUrl;
      let assetId = publicId;
      let assetBytes = size;

      const foreignLink =
        !publicId &&
        normalizedUrl.startsWith("https://") &&
        !normalizedUrl.startsWith("https://res.cloudinary.com/");

      if (foreignLink && !busy.current) {
        busy.current = true;
        setIsUploading(true);
        try {
          const outcome = await uploadMediaRequest(normalizedUrl);
          if (outcome.status === "uploaded") {
            sourceUrl = outcome.asset.url;
            assetId = outcome.asset.publicId;
            assetBytes = outcome.asset.bytes ?? size;
            if (!quiet) toast.success("Copied that picture into your Media Library");
          } else if (outcome.status === "failed") {
            // Keeping the pasted link is still better than losing the edit —
            // the renderer serves a foreign host unoptimised rather than
            // throwing — but the admin has to know the copy did not happen.
            toast.warning("Kept the link, but could not copy the picture", {
              description:
                "Your image host refused it. The picture will still show, but it stays on the other site.",
            });
          }
          // "unconfigured" is not a failure: this shop has no image host, and
          // storing the link is the intended behaviour.
        } finally {
          busy.current = false;
          setIsUploading(false);
        }
      }

      const { value: file, persisted } = await addMediaFile({
        name: name ?? fileNameFromUrl(normalizedUrl),
        url: sourceUrl,
        // Nothing invented.
        //
        // A pasted URL used to be recorded as 220,000 bytes at 1200×1200 in
        // image/jpeg — none of it true, and all of it counted: the Storage stat
        // grew by a fictional 215 KB per entry and the dimensions were shown in
        // the detail panel as fact. What is not known is left unset.
        type: "image",
        mimeType: mimeType ?? "",
        size: assetBytes ?? 0,
        alt: "",
        publicId: assetId,
      });

      onAdded(file);
      if (!quiet) reportWrite(persisted, "Image added to media library");
      return { file, persisted };
    },
    [onAdded],
  );

  /**
   * One file. Returns whether the SERVER has it — not merely that nothing threw.
   *
   * Every photograph is resized in the browser first: a phone camera writes
   * 4-25 MB and nothing here is ever drawn wider than about 800 CSS pixels, so
   * the upload was spending its time on detail no visitor sees. See
   * lib/images/shrink-image.ts for what is deliberately NOT re-encoded.
   */
  const uploadOne = useCallback(
    async (file: File, quiet: boolean): Promise<boolean> => {
      try {
        const { dataUrl, bytes } = await shrinkImageFile(file);

        if (bytes > MAX_UPLOAD_BYTES) {
          toast.error(`${file.name} is too large to upload`, {
            description: `Even after resizing it is over ${Math.round(
              MAX_UPLOAD_BYTES / 1024 / 1024,
            )} MB.`,
          });
          return false;
        }

        const outcome = await uploadMediaRequest(dataUrl);

        if (outcome.status === "uploaded") {
          const added = await addFromUrl(outcome.asset.url, {
            name: file.name,
            size: outcome.asset.bytes ?? bytes,
            publicId: outcome.asset.publicId,
            mimeType: file.type,
            quiet,
          });
          return Boolean(added?.persisted);
        }

        /**
         * A REJECTED upload is not the same as a shop with no image host, and
         * treating them alike is how a configured shop silently began storing
         * base64 in its own product records. Nothing is stored here.
         */
        if (outcome.status === "failed") {
          toast.error(`Could not upload ${file.name}`, {
            description: "Your image host refused it. Check the account, then try again.",
          });
          return false;
        }

        /**
         * No image host at all. The whole image is stored inline, as base64, in
         * this browser's localStorage AND in one Mongo document. Base64 adds
         * about a third, browsers cap localStorage near 5 MB and a Mongo
         * document at 16, so a few photos take the library past both — the
         * setItem throws, the image vanishes and every later save fails too.
         * Refused with a reason instead.
         */
        if (bytes > MAX_INLINE_BYTES) {
          toast.error("Image storage is not configured", {
            description: `Without an image host, uploads must stay under ${Math.round(
              MAX_INLINE_BYTES / 1024,
            )} KB. Add Cloudinary credentials, or paste a hosted image URL instead.`,
            duration: 10000,
          });
          return false;
        }

        const added = await addFromUrl(dataUrl, {
          name: file.name,
          size: bytes,
          mimeType: file.type,
          quiet,
        });
        return Boolean(added?.persisted);
      } catch (error) {
        // Previously a try/finally with no catch: a quota failure escaped as an
        // unhandled rejection, so the spinner stopped, the dialog stayed open,
        // and nothing at all told the admin their image had not been saved.
        toast.error(
          error instanceof Error && /quota/i.test(error.message)
            ? "This browser is out of storage for the media library"
            : `Could not add ${file.name}`,
        );
        return false;
      }
    },
    [addFromUrl],
  );

  /**
   * Every file the admin chose, not just the first one.
   *
   * Taking `fileList[0]` meant a shop putting twelve cakes online repeated the
   * whole choose-wait-confirm cycle twelve times.
   *
   * Sequential rather than parallel on purpose: this runs on a phone on mobile
   * data, and twelve simultaneous multi-megabyte requests are slower in
   * practice than twelve queued ones, as well as being harder to report on.
   *
   * Returns null when it DECLINED because another batch is running, so a caller
   * can tell "nothing happened" from "nothing was added".
   */
  const uploadFiles = useCallback(
    // `File[]` as well as `FileList`, because a paste arrives as clipboard
    // items rather than as a file input's list.
    async (fileList: FileList | File[] | null): Promise<BatchResult | null> => {
      if (busy.current) return null;

      const chosen = Array.from(fileList ?? []);
      if (chosen.length === 0) return null;

      const images = chosen.filter((file) => file.type.startsWith("image/"));
      // Checked against the ORIGINAL only as a decode sanity bound; the real
      // size limit is applied to what we actually send, after shrinking.
      const usable = images.filter((file) => file.size <= MAX_SOURCE_BYTES);

      if (images.length < chosen.length) {
        toast.error(
          chosen.length === 1
            ? "Only image files are supported"
            : `Skipped ${chosen.length - images.length} file(s) that are not images`,
        );
      }

      if (usable.length < images.length) {
        toast.error("That image is far too large to open", {
          description: `Files over ${Math.round(MAX_SOURCE_BYTES / 1024 / 1024)} MB cannot be read in the browser.`,
        });
      }

      if (usable.length === 0) return { added: 0, total: 0 };

      busy.current = true;
      setIsUploading(true);
      setProgress({ done: 0, total: usable.length });

      // Quiet the per-file reporting for a batch; one summary follows instead.
      const batch = usable.length > 1;
      let added = 0;
      let attempted = 0;

      try {
        for (const file of usable) {
          const ok = await uploadOne(file, batch);
          if (ok) added += 1;
          attempted += 1;
          // Counts files PROCESSED, not files that succeeded — a stalled
          // counter would read as a hung upload.
          setProgress({ done: attempted, total: usable.length });
        }
      } finally {
        busy.current = false;
        setIsUploading(false);
        setProgress(null);
      }

      /**
       * Counted from what the SERVER took. The summary used to count files that
       * merely did not throw, so a batch whose every write the server refused
       * still said "12 photos added" — and `quiet` had suppressed the only
       * report that would have said otherwise.
       */
      if (batch && added > 0) {
        toast.success(
          added === usable.length
            ? `${added} photos added to your Media Library`
            : `${added} of ${usable.length} photos added`,
        );
      }
      // Guarded, because "could not be saved" is a claim about the SERVER, and
      // an expired admin session produces exactly the same symptom. The
      // reporter says so itself when that is what happened.
      if (batch && added < usable.length) {
        if (!reportedAsSignedOut()) toast.error(`${usable.length - added} photo(s) could not be saved`, {
          description: "Check your connection and your image host, then try those again.",
        });
      }

      return { added, total: usable.length };
    },
    [uploadOne],
  );

  return { isUploading, progress, addFromUrl, uploadFiles };
}
