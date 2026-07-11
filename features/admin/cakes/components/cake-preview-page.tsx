"use client";

import Link from "next/link";
import { SafeImage } from "@/components/shared/safe-image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import type { Cake } from "@/types";
import { formatCurrency, formatDate } from "@/utils/format";
import { adminCategories, adminFlavours, adminOccasions } from "../lib/catalog-options";
import { formatStatusLabel } from "../lib/cake-utils";
import { getCakeById } from "../lib/cakes-repository";
import { AdminPage, AdminPageHeader } from "@/features/admin/components";

interface CakePreviewPageProps {
  cakeId: string;
}

export function CakePreviewPage({ cakeId }: CakePreviewPageProps) {
  const router = useRouter();
  const [cake, setCake] = useState<Cake | null>(null);

  useEffect(() => {
    const found = getCakeById(cakeId);
    if (!found) {
      router.replace(routes.admin.cakes.list);
      return;
    }
    setCake(found);
  }, [cakeId, router]);

  if (!cake) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const category = adminCategories().find((item) => item.id === cake.categoryId)?.name ?? "—";
  const flavour = adminFlavours().find((item) => item.id === cake.flavourId)?.name;
  const occasions = adminOccasions()
    .filter((item) => cake.occasionIds.includes(item.id))
    .map((item) => item.name)
    .join(", ");

  return (
    <AdminPage>
      <AdminPageHeader
        title="Preview Cake"
        description="Review how this cake will appear before publishing to the storefront."
        actions={
          <>
            <Button variant="outline" render={<Link href={routes.admin.cakes.edit(cake.id)} />}>
              <Pencil className="size-4" />
              Edit
            </Button>
            <Button
              variant="bakery"
              render={
                <a href={routes.store.cake(cake.slug)} target="_blank" rel="noopener noreferrer" />
              }
            >
              <ExternalLink className="size-4" />
              Open Storefront
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="relative aspect-square bg-muted">
            {cake.images[0] ? (
              <SafeImage src={cake.images[0]} alt={cake.name} className="object-cover" />
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={cake.status === "published" ? "success" : "outline"}>
                {formatStatusLabel(cake.status)}
              </Badge>
              {cake.isFeatured ? <Badge variant="gold">Featured</Badge> : null}
              {cake.isTrending ? <Badge variant="outline">Trending</Badge> : null}
              {cake.isBestSeller ? <Badge variant="bakery">Best Seller</Badge> : null}
            </div>
            <CardTitle className="font-heading text-2xl">{cake.name}</CardTitle>
            <CardDescription>{cake.shortDescription || cake.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-2xl font-bold">
                {formatCurrency(cake.price)}
              </span>
              {cake.compareAtPrice ? (
                <span className="text-muted-foreground line-through">
                  {formatCurrency(cake.compareAtPrice)}
                </span>
              ) : null}
            </div>
            <dl className="grid gap-2">
              <div className="flex justify-between gap-4 border-b border-border/60 py-2">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="font-medium">{category}</dd>
              </div>
              {flavour ? (
                <div className="flex justify-between gap-4 border-b border-border/60 py-2">
                  <dt className="text-muted-foreground">Flavour</dt>
                  <dd className="font-medium">{flavour}</dd>
                </div>
              ) : null}
              {occasions ? (
                <div className="flex justify-between gap-4 border-b border-border/60 py-2">
                  <dt className="text-muted-foreground">Occasions</dt>
                  <dd className="text-right font-medium">{occasions}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-4 border-b border-border/60 py-2">
                <dt className="text-muted-foreground">Slug</dt>
                <dd className="font-mono text-xs">{cake.slug}</dd>
              </div>
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-muted-foreground">Last updated</dt>
                <dd>{formatDate(cake.updatedAt)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}
