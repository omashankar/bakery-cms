"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { getRecentInquiries } from "@/features/admin/inquiries";
import { formatRelativeTime } from "@/utils/format";
import { formatInquiryType } from "@/features/inquiries/lib/inquiry-utils";
import { InquiryStatusBadge } from "@/features/admin/inquiries/components/inquiry-status-badge";
import type { Inquiry } from "@/types/inquiry";

export function DashboardInquiriesPanel() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);

  useEffect(() => {
    function refresh() {
      setInquiries(getRecentInquiries(4));
    }

    refresh();
    window.addEventListener("bakery-inquiries-updated", refresh);
    return () => window.removeEventListener("bakery-inquiries-updated", refresh);
  }, []);

  return (
    <Card className="flex h-full flex-col shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base">Recent inquiries</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          render={<Link href={routes.admin.inquiries.overview} />}
        >
          View all
          <ArrowRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pt-0">
        {inquiries.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-center">
            <div>
              <Inbox className="mx-auto mb-2 size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No inquiries yet</p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {inquiries.map((inquiry) => (
              <li
                key={inquiry.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{inquiry.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatInquiryType(inquiry.type)} · {formatRelativeTime(inquiry.createdAt)}
                  </p>
                </div>
                <InquiryStatusBadge status={inquiry.status} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
