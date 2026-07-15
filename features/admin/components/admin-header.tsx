"use client";

import Link from "next/link";
import { useEffect, useState, type Ref } from "react";
import { KeyRound, LogOut, Menu, PanelLeft, PanelLeftClose, Search, User, X } from "lucide-react";
import { LogoutConfirmDialog } from "@/features/admin/profile/components/logout-confirm-dialog";
import { getAdminProfile } from "@/features/admin/profile/lib/admin-profile";
import { getDemoSession } from "@/features/auth/lib/session";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminNotificationBell } from "@/features/admin/commerce/components/admin-notification-bell";
import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";
import { AdminBreadcrumbs } from "./admin-breadcrumbs";
import {
  AdminCommandSearch,
  AdminCommandSearchTrigger,
} from "./admin-command-search";
import { adminShell } from "./admin-shell";

interface AdminHeaderProps {
  collapsed: boolean;
  mobileOpen: boolean;
  mobileNavId: string;
  menuButtonRef?: Ref<HTMLButtonElement>;
  onMobileMenuToggle: () => void;
  onSidebarToggle: () => void;
}

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "AU";
  const parts = local.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "AU";
}

export function AdminHeader({
  collapsed,
  mobileOpen,
  mobileNavId,
  menuButtonRef,
  onMobileMenuToggle,
  onSidebarToggle,
}: AdminHeaderProps) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [initials, setInitials] = useState("AU");
  const [displayName, setDisplayName] = useState("Administrator");
  const [email, setEmail] = useState("");

  useEffect(() => {
    const session = getDemoSession();
    if (session?.email) setInitials(initialsFromEmail(session.email));
    const profile = getAdminProfile();
    setDisplayName(profile.fullName);
    setEmail(profile.email);
  }, []);

  return (
    <>
      <AdminCommandSearch open={commandOpen} onOpenChange={setCommandOpen} />

      <header className={cn("sticky top-0 z-40 pt-[env(safe-area-inset-top)]", adminShell.header)}>
        <div
          className={cn(
            "flex items-center gap-2 sm:gap-3",
            adminShell.contentWrap,
            adminShell.chromeHeight
          )}
        >
          <Button
            ref={menuButtonRef}
            variant="ghost"
            size="icon"
            className={cn("shrink-0 lg:hidden", adminShell.iconButton)}
            onClick={onMobileMenuToggle}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls={mobileNavId}
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className={cn("hidden shrink-0 lg:inline-flex", adminShell.iconButton)}
            onClick={onSidebarToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>

          <div className="hidden h-5 w-px shrink-0 bg-sidebar-border md:block" aria-hidden />

          <div className="hidden min-w-0 flex-1 md:block">
            <AdminBreadcrumbs />
          </div>

          {/* Grow on mobile so actions stay right when breadcrumbs/search are hidden */}
          <div className="min-w-0 flex-1 md:hidden" aria-hidden />

          <div className="hidden min-w-0 sm:block sm:w-full sm:max-w-[200px] md:max-w-[220px] lg:max-w-xs">
            <AdminCommandSearchTrigger onOpen={() => setCommandOpen(true)} />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className={cn("shrink-0 sm:hidden", adminShell.iconButton)}
            onClick={() => setCommandOpen(true)}
            aria-label="Open search"
          >
            <Search className="size-4" />
          </Button>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <AdminNotificationBell />
            <ThemeToggle className={adminShell.iconButton} />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className={adminShell.iconButton}
                    aria-label="Account menu"
                  />
                }
              >
                <Avatar className="size-7 ring-1 ring-sidebar-border">
                  <AvatarFallback className="bg-primary/15 text-[10px] font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center gap-3 px-2 py-1.5">
                  <Avatar className="size-9 ring-1 ring-sidebar-border">
                    <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                    {email ? (
                      <p className="truncate text-xs text-muted-foreground">{email}</p>
                    ) : null}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href={routes.admin.profile} />}>
                  <User className="size-4" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href={routes.admin.changePassword} />}>
                  <KeyRound className="size-4" />
                  Change Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setLogoutOpen(true)}>
                  <LogOut className="size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div
          className={cn("border-t border-sidebar-border/60 py-2 md:hidden", adminShell.contentWrap)}
        >
          <AdminBreadcrumbs className="text-xs" />
        </div>
      </header>

      <LogoutConfirmDialog open={logoutOpen} onOpenChange={setLogoutOpen} />
    </>
  );
}
