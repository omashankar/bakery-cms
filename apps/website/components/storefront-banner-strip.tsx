"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getActiveHeroBanners } from "@/features/content/lib/banners-repository";
import type { Banner } from "@/types/media";

export function StorefrontBannerStrip() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setBanners(getActiveHeroBanners("homepage"));
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % banners.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  if (dismissed || banners.length === 0) return null;

  const banner = banners[index];
  if (!banner) return null;

  const content = (
    <div className="relative flex items-center gap-3 bg-bakery-700 px-4 py-2.5 text-sm text-white">
      <div className="relative size-8 shrink-0 overflow-hidden rounded-md border border-white/20">
        <Image src={banner.image} alt="" fill className="object-cover" sizes="32px" />
      </div>
      <p className="min-w-0 flex-1 truncate font-medium">{banner.title}</p>
      {banner.link ? <span className="hidden text-xs underline sm:inline">View offer</span> : null}
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDismissed(true);
        }}
        className="rounded-md p-1 hover:bg-white/10"
        aria-label="Dismiss banner"
      >
        <X className="size-4" />
      </button>
    </div>
  );

  if (banner.link) {
    return (
      <Link href={banner.link} className="block transition-opacity hover:opacity-95">
        {content}
      </Link>
    );
  }

  return content;
}
