"use client";

import Link from "next/link";
import { FileCode2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { SettingsPlaceholder } from "./settings-placeholder";

/**
 * THIS SCREEN READ AS 'YOUR SITE IS NOT IN SEARCH YET'.
 *
 * Both files are generated on every request and served right now. The only
 * sentence on the page that said so was the last one, in the smallest grey
 * box, under a "Coming soon" badge and a checklist of four things the owner
 * cannot do — so the page somebody opens to check on search engines told
 * them, in every way except one, that nothing was working yet.
 *
 * What is genuinely not built is editing these files BY HAND, and that is what
 * the list is for now. Two of its rows have gone with the rest: submitting a
 * sitemap is done at Google, not from here, and nothing in this CMS knows what
 * a staging site is, so neither was ever going to arrive on this page.
 */
export function SeoFilesSettingsPage() {
  return (
    <SettingsPlaceholder
      title="Robots.txt &amp; Sitemap"
      description="The two files search engines read before anything else. Both are already live — there is nothing here you need to switch on."
      icon={FileCode2}
      features={[
        "Write your own robots.txt rules instead of the generated ones",
        "Say how often each kind of page is worth checking again",
        "Leave a page out of the sitemap without hiding it from customers",
      ]}
      note={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            Both files are built from what you save under SEO — whether search engines may
            list this site at all, and the address it is listed under. Open that screen to
            read either file as a crawler sees it.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            render={<Link href={routes.admin.seo} />}
            nativeButton={false}
          >
            Open SEO
          </Button>
        </div>
      }
    />
  );
}
