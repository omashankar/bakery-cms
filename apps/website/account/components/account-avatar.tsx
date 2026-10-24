"use client";

import { Camera, Loader2 } from "lucide-react";
import { OptimizedImage } from "@/components/shared/optimized-image";
import { getAccountInitials } from "@/apps/website/account/lib/account-initials";
import { cn } from "@/lib/utils";

/**
 * WHAT GOES INSIDE A CUSTOMER'S ROUND MARK: their photo, filling the circle,
 * or their initials. The circle itself — size, colour, `overflow-hidden` — is
 * the caller's, because the header button, the menu and the account sidebar
 * each draw a different one.
 */
export function AccountAvatarFace({
  name,
  avatarUrl,
  size,
}: {
  name: string;
  avatarUrl?: string;
  /** The circle's width in CSS pixels, so the photo is fetched at that size. */
  size: number;
}) {
  if (!avatarUrl) return <>{getAccountInitials(name)}</>;
  return (
    <OptimizedImage
      src={avatarUrl}
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
      // Eager: every avatar is in the header or the first screenful, and a
      // lazy one painted as an empty circle on every page load.
      loading="eager"
      className="size-full object-cover"
    />
  );
}

/**
 * THE AVATAR AS ITS OWN "CHANGE PHOTO" BUTTON — the sidebar's and the profile
 * card's, so the two cannot drift. A camera badge says it can be pressed, a
 * hover darkens it with the camera again, and a spinner covers it while an
 * upload is on its way.
 */
export function EditableAvatar({
  name,
  avatarUrl,
  busy,
  onChoose,
  className,
  ready = true,
}: {
  name: string;
  avatarUrl?: string;
  busy: boolean;
  onChoose: () => void;
  /** The circle: its size, colour, ring and type size. */
  className: string;
  /** False until the name is known, so "U" never flashes for a signed-in customer. */
  ready?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChoose}
      disabled={busy}
      aria-label={avatarUrl ? "Change profile photo" : "Add profile photo"}
      className="group relative block shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-gold-400 focus-visible:ring-offset-2 disabled:cursor-wait"
    >
      <span
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-full font-bold",
          className,
        )}
      >
        {ready ? <AccountAvatarFace name={name} avatarUrl={avatarUrl} size={80} /> : null}
      </span>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white transition-opacity",
          busy ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        aria-hidden
      >
        {busy ? <Loader2 className="size-5 animate-spin" /> : <Camera className="size-5" />}
      </span>
      <span
        className="absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full border-2 border-white bg-gold-400 text-bakery-900 shadow-md"
        aria-hidden
      >
        <Camera className="size-3.5" />
      </span>
    </button>
  );
}
