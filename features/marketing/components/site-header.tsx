"use client";

import { useEffect, useState } from "react";
import { MenuIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ctaLinks, navLinks } from "../landing-data";
import { LinkButton } from "./link-button";
import { Logo } from "./logo";

function NavItem({
  label,
  href,
  soon,
  onClick,
  className,
}: {
  label: string;
  href: string;
  soon?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  if (soon) {
    return (
      <span
        className={cn(
          "inline-flex cursor-default items-center gap-1.5 text-sm font-medium text-muted-foreground/70",
          className
        )}
      >
        {label}
        <span className="rounded-full bg-[#F1EBE3] px-1.5 py-0.5 text-[10px] font-semibold text-[#a07d52]">
          Soon
        </span>
      </span>
    );
  }
  return (
    <a
      href={href}
      onClick={onClick}
      className={cn(
        "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        className
      )}
    >
      {label}
    </a>
  );
}

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const close = () => setOpen(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        scrolled || open
          ? "border-border bg-[#FAF9F7]/85 backdrop-blur-md"
          : "border-transparent bg-[#FAF9F7]/60 backdrop-blur-sm"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6 lg:px-8">
        <Logo />

        {/* Center nav */}
        <nav className="hidden items-center gap-8 lg:flex">
          {navLinks.map((link) => (
            <NavItem key={link.label} {...link} />
          ))}
        </nav>

        {/* Right actions */}
        <div className="hidden items-center gap-2 lg:flex">
          <LinkButton href={ctaLinks.admin} variant="ghost">
            Admin Demo
          </LinkButton>
          <LinkButton href={ctaLinks.store} variant="secondary">
            View Store
          </LinkButton>
          <LinkButton href={ctaLinks.getStarted} variant="primary">
            Get Started
          </LinkButton>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex size-10 items-center justify-center rounded-xl border border-border bg-card text-foreground shadow-sm lg:hidden"
        >
          {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
        </button>
      </div>

      {/* Mobile panel */}
      {open ? (
        <div className="border-t border-border bg-[#FAF9F7] lg:hidden">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-6 py-4">
            {navLinks.map((link) => (
              <NavItem
                key={link.label}
                {...link}
                onClick={close}
                className="rounded-lg px-2 py-2.5 hover:bg-[#F1EBE3]"
              />
            ))}
            <div className="mt-3 flex flex-col gap-2">
              <LinkButton href={ctaLinks.admin} variant="secondary" className="w-full">
                Admin Demo
              </LinkButton>
              <LinkButton href={ctaLinks.store} variant="secondary" className="w-full">
                View Store
              </LinkButton>
              <LinkButton href={ctaLinks.getStarted} variant="primary" className="w-full">
                Get Started
              </LinkButton>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
