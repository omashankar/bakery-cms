"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { toast } from "@/lib/lazy-toast";
import { shrinkImageForUpload } from "@/lib/images/shrink-image";
import {
  removeCustomerAvatar,
  uploadCustomerAvatar,
} from "@/apps/website/account/lib/customer-session";

/** The server's limits (photo-upload.service), checked here first to save the wait. */
const MAX_BYTES = 6 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Choose, upload and remove the customer's profile photo.
 *
 * Spread `inputProps` on a hidden file input and call `choose` from any button.
 * The new photo reaches every avatar on the page through the session event, so
 * the caller has nothing to set.
 */
export function useAvatarEditor() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const choose = () => inputRef.current?.click();

  const onChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared, so choosing the same file again is still a change.
    event.target.value = "";
    if (!file) return;
    // An empty type is let through: some Android pickers report none for a
    // real photo. The server reads the bytes and refuses anything else.
    if (file.type && !file.type.startsWith("image/")) {
      toast.error("Please choose a JPG, PNG or WebP photo");
      return;
    }

    setBusy(true);
    // Shrunk first, as the admin's uploads are: a phone's 8 MB original was
    // refused outright, and an accepted one was stored to fill an 80px circle.
    const photo = await shrinkImageForUpload(file);
    if (photo.size > MAX_BYTES) {
      setBusy(false);
      toast.error("That photo is too large", { description: "Please use an image under 6 MB." });
      return;
    }
    const result = await uploadCustomerAvatar(photo);
    setBusy(false);
    if ("error" in result) {
      toast.error("Could not update your photo", { description: result.error });
      return;
    }
    toast.success("Profile photo updated");
  };

  const remove = async () => {
    setBusy(true);
    const result = await removeCustomerAvatar();
    setBusy(false);
    if ("error" in result) {
      toast.error("Could not remove your photo", { description: result.error });
      return;
    }
    toast.success("Profile photo removed");
  };

  return {
    busy,
    choose,
    remove,
    inputProps: {
      ref: inputRef,
      type: "file" as const,
      accept: TYPES.join(","),
      className: "hidden",
      tabIndex: -1,
      "aria-hidden": true,
      onChange: (event: ChangeEvent<HTMLInputElement>) => void onChange(event),
    },
  };
}
