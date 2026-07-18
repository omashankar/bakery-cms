"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { routes } from "@/constants/routes";
import { INVENTORY_UPDATED_EVENT } from "@/apps/admin/commerce/lib/inventory-repository";
import { INQUIRIES_UPDATED_EVENT } from "@/features/inquiries/lib/inquiries-repository";
import {
  countUnreadNotifications,
  getRecentNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_UPDATED_EVENT,
  syncNotifications,
} from "@/apps/admin/commerce/lib/notifications-repository";
import type { AdminNotification } from "@/types/notification";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { adminShell } from "@/apps/admin/components/admin-shell";
import { NotificationListItem } from "./notification-list-item";

export function AdminNotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  function refresh() {
    syncNotifications();
    setNotifications(getRecentNotifications(6));
    setUnreadCount(countUnreadNotifications());
  }

  useEffect(() => {
    refresh();

    function handleRefresh() {
      refresh();
    }

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, handleRefresh);
    window.addEventListener("bakery-orders-updated", handleRefresh);
    window.addEventListener(INVENTORY_UPDATED_EVENT, handleRefresh);
    window.addEventListener(INQUIRIES_UPDATED_EVENT, handleRefresh);

    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, handleRefresh);
      window.removeEventListener("bakery-orders-updated", handleRefresh);
      window.removeEventListener(INVENTORY_UPDATED_EVENT, handleRefresh);
      window.removeEventListener(INQUIRIES_UPDATED_EVENT, handleRefresh);
    };
  }, []);

  function handleMarkRead(id: string) {
    markNotificationRead(id);
    refresh();
  }

  function handleMarkAllRead() {
    markAllNotificationsRead();
    refresh();
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn("relative", adminShell.iconButton)}
            aria-label="Notifications"
          />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : (
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-gold-500" />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[min(100vw-2rem,380px)] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>
          {unreadCount > 0 ? (
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          ) : null}
        </div>

        <div className="max-h-[min(60vh,420px)] space-y-2 overflow-y-auto p-3">
          {notifications.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/50 px-4 py-8 text-center">
              <Bell className="mx-auto size-8 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium">No alerts right now</p>
              <p className="mt-1 text-xs text-muted-foreground">
                New orders, stock alerts, and inquiries will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationListItem
                key={notification.id}
                notification={notification}
                compact
                onMarkRead={handleMarkRead}
                onNavigate={() => setOpen(false)}
              />
            ))
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem render={<Link href={routes.admin.commerce.notifications} />}>
          View notification center
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
