import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface StorePageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  className?: string;
}

export function StorePageHeader({
  title,
  description,
  breadcrumbs = [],
  className,
}: StorePageHeaderProps) {
  const trail = [{ label: "Home", href: routes.store.home }, ...breadcrumbs];

  return (
    <div className={cn("border-b border-border bg-cream-100", className)}>
      <div className={cn(layoutSpacing.container, "py-8 sm:py-10")}>
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            {trail.map((item, index) => {
              const isLast = index === trail.length - 1;
              return (
                <span key={`${item.label}-${index}`} className="contents">
                  <BreadcrumbItem>
                    {isLast || !item.href ? (
                      <BreadcrumbPage>{item.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link href={item.href} />}>
                        {item.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast ? <BreadcrumbSeparator /> : null}
                </span>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}
