"use client";

import Link from "next/link";
import type { AdminNotification } from "@/types/notification";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/utils/format";
import {
  NotificationTypeBadge,
  NotificationTypeIcon,
} from "./notification-type-badge";

interface NotificationListItemProps {
  notification: AdminNotification;
  compact?: boolean;
  onMarkRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onNavigate?: () => void;
}

export function NotificationListItem({
  notification,
  compact = false,
  onMarkRead,
  onDismiss,
  onNavigate,
}: NotificationListItemProps) {
  const showActions = Boolean((onMarkRead || onDismiss) && !compact);

  const actions = showActions ? (
    <div className="flex shrink-0 flex-row gap-1 sm:flex-col">
      {!notification.read && onMarkRead ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 flex-1 px-2 text-xs sm:flex-none"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onMarkRead(notification.id);
          }}
        >
          Mark read
        </Button>
      ) : null}
      {onDismiss ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 flex-1 px-2 text-xs text-muted-foreground sm:flex-none"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDismiss(notification.id);
          }}
        >
          Dismiss
        </Button>
      ) : null}
    </div>
  ) : null;

  const content = (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-3 transition-premium sm:p-3.5",
        !notification.read && "border-l-[3px] border-l-primary bg-muted",
        notification.href && "hover:border-primary/40"
      )}
    >
      <div className="flex gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            notification.read ? "bg-muted text-muted-foreground" : "bg-primary/15 text-foreground"
          )}
        >
          <NotificationTypeIcon type={notification.type} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <p className="min-w-0 truncate text-sm font-medium text-foreground">
              {notification.title}
            </p>
            {!compact ? (
              <span className="hidden sm:inline-flex">
                <NotificationTypeBadge type={notification.type} />
              </span>
            ) : null}
            {!notification.read ? (
              <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
            ) : null}
          </div>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{notification.message}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {formatRelativeTime(notification.createdAt)}
            </p>
            {!compact ? (
              <span className="sm:hidden">
                <NotificationTypeBadge type={notification.type} />
              </span>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="hidden shrink-0 flex-col sm:flex">{actions}</div>
        ) : null}
      </div>

      {actions ? (
        <div className="mt-2.5 border-t border-border/60 pt-2 sm:hidden">{actions}</div>
      ) : null}
    </div>
  );

  if (notification.href) {
    return (
      <Link href={notification.href} onClick={onNavigate} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
