"use client";

import Link from "next/link";
import { SafeImage } from "@/components/shared/safe-image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { routes } from "@/constants/routes";
import { AdminMobileActionBar, AdminPage, AdminPageHeader } from "@/features/admin/components";
import type { CakeFormData, EntityStatus } from "@/types";
import { formatCurrency } from "@/utils/format";
import {
  adminCategories,
  adminFlavours,
  adminOccasions,
  getDefaultWeights,
} from "../lib/catalog-options";
import { slugify } from "../lib/cake-utils";
import {
  createCake,
  createEmptyCakeForm,
  getCakeById,
  updateCake,
} from "../lib/cakes-repository";
import {
  deriveStockStatus,
  resolveStockFields,
} from "@/features/admin/commerce/lib/inventory-utils";
import { StockStatusBadge } from "@/features/admin/commerce/components/stock-status-badge";
import { getInventorySettings } from "@/features/admin/commerce/lib/inventory-repository";
import { AdminSelect, adminTextareaClassName } from "./admin-field";
import { CakeMediaPicker } from "./cake-media-picker";
import { CakeProductDetailsFields } from "./cake-product-details-fields";
import { CakeVariantManager } from "./cake-variant-manager";
import {
  createVariantGroup,
  createVariantOption,
  getDefaultVariantSelections,
  syncLegacyFlagsFromVariants,
} from "../lib/variant-utils";

interface CakeFormPageProps {
  mode: "add" | "edit";
  cakeId?: string;
}

export function CakeFormPage({ mode, cakeId }: CakeFormPageProps) {
  const router = useRouter();
  const [form, setForm] = useState<CakeFormData>(createEmptyCakeForm);
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSaving, setIsSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  useEffect(() => {
    if (mode !== "edit" || !cakeId) return;
    const existing = getCakeById(cakeId);
    if (!existing) {
      toast.error("Cake not found");
      router.replace(routes.admin.cakes.list);
      return;
    }
    const { id: _id, createdAt: _c, updatedAt: _u, ...data } = existing;
    setForm(data);
    setIsLoading(false);
  }, [mode, cakeId, router]);

  function patchForm(patch: Partial<CakeFormData>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleNameChange(name: string) {
    setForm((prev) => ({
      ...prev,
      name,
      slug: slugTouched ? prev.slug : slugify(name),
      seo: {
        ...prev.seo,
        metaTitle: prev.seo.metaTitle || `${name} | Monginis`,
      },
    }));
  }

  function handlePriceChange(price: number) {
    setForm((prev) => ({
      ...prev,
      price,
      weights: getDefaultWeights(price),
    }));
  }

  function toggleOccasion(id: string, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      occasionIds: checked
        ? [...prev.occasionIds, id]
        : prev.occasionIds.filter((item) => item !== id),
    }));
  }

  function updateWeightPrice(index: number, price: number) {
    setForm((prev) => ({
      ...prev,
      weights: prev.weights.map((weight, i) =>
        i === index ? { ...weight, price: Math.max(0, price) } : weight
      ),
    }));
  }

  function toggleShape(shape: string, checked: boolean) {
    setForm((prev) => ({
      ...prev,
      shapes: checked
        ? [...prev.shapes, shape]
        : prev.shapes.filter((item) => item !== shape),
    }));
  }

  async function saveCake(status: EntityStatus, redirectToList = true) {
    if (!form.name.trim()) {
      toast.error("Cake name is required");
      return;
    }
    if (!form.slug.trim()) {
      toast.error("Slug is required");
      return;
    }

    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const payload: CakeFormData = {
      ...form,
      name: form.name.trim(),
      slug: slugify(form.slug),
      status,
      images: form.images.filter(Boolean),
      ...resolveStockFields(form),
      ...syncLegacyFlagsFromVariants(
        form.variantGroups,
        getDefaultVariantSelections(form.variantGroups)
      ),
    };

    if (mode === "add") {
      createCake(payload);
      toast.success(status === "published" ? "Cake published" : "Cake saved as draft");
    } else if (cakeId) {
      updateCake(cakeId, payload);
      toast.success(status === "published" ? "Cake updated & published" : "Draft saved");
    }

    setIsSaving(false);
    if (redirectToList) router.push(routes.admin.cakes.list);
  }

  function openPreview() {
    if (!form.slug) {
      toast.error("Add a slug before previewing");
      return;
    }
    window.open(routes.store.cake(form.slug), "_blank", "noopener,noreferrer");
  }

  if (isLoading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const title = mode === "add" ? "Add Cake" : "Edit Cake";

  return (
    <AdminPage className="space-y-4 sm:space-y-5 pb-20 xl:pb-0">
      <AdminPageHeader
        title={title}
        description={
          mode === "add"
            ? "Create a product with pricing, commerce options, classification, and SEO."
            : "Update product details, stock, customization options, and publishing status."
        }
        actions={
          <div className="hidden flex-wrap items-center gap-2 xl:flex">
            <Button variant="outline" onClick={openPreview} disabled={!form.slug}>
              <ExternalLink className="size-4" />
              Preview
            </Button>
            <Button variant="outline" disabled={isSaving} onClick={() => saveCake("draft")}>
              Save Draft
            </Button>
            <Button variant="bakery" disabled={isSaving} onClick={() => saveCake("published")}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Publish
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="basic">
              <TabsList className="mb-6 w-full justify-start overflow-x-auto">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="variants">Variants</TabsTrigger>
                <TabsTrigger value="classification">Classification</TabsTrigger>
                <TabsTrigger value="commerce">Commerce</TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Cake name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Chocolate Truffle Delight"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">URL slug</Label>
                  <Input
                    id="slug"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      patchForm({ slug: slugify(e.target.value) });
                    }}
                    placeholder="chocolate-truffle-delight"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shortDescription">Short description</Label>
                  <Input
                    id="shortDescription"
                    value={form.shortDescription ?? ""}
                    onChange={(e) => patchForm({ shortDescription: e.target.value })}
                    placeholder="One-line summary for cards"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Full description</Label>
                  <textarea
                    id="description"
                    className={adminTextareaClassName}
                    value={form.description}
                    onChange={(e) => patchForm({ description: e.target.value })}
                    placeholder="Describe flavours, layers, and serving notes..."
                  />
                </div>
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="price">Base price (INR)</Label>
                    <Input
                      id="price"
                      type="number"
                      min={0}
                      value={form.price}
                      onChange={(e) => handlePriceChange(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compareAtPrice">Compare-at price</Label>
                    <Input
                      id="compareAtPrice"
                      type="number"
                      min={0}
                      value={form.compareAtPrice ?? ""}
                      onChange={(e) =>
                        patchForm({
                          compareAtPrice: e.target.value
                            ? Number(e.target.value)
                            : undefined,
                        })
                      }
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-medium">Weight variants</p>
                  {form.weights.map((weight, index) => (
                    <div
                      key={weight.label}
                      className="grid gap-3 rounded-lg border border-border px-3 py-3 sm:grid-cols-[1fr_120px]"
                    >
                      <div>
                        <p className="text-sm font-medium">{weight.label}</p>
                        {weight.serves ? (
                          <p className="text-xs text-muted-foreground">Serves {weight.serves}</p>
                        ) : null}
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`weight-${index}`}>Price (INR)</Label>
                        <Input
                          id={`weight-${index}`}
                          type="number"
                          min={0}
                          value={weight.price}
                          onChange={(e) =>
                            updateWeightPrice(index, Number(e.target.value) || 0)
                          }
                        />
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    Weight presets come from Catalog. Edit prices per variant for this product.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="details" className="space-y-4">
                <CakeProductDetailsFields
                  value={form}
                  onChange={(patch) => patchForm(patch)}
                />
              </TabsContent>

              <TabsContent value="variants" className="space-y-4">
                <CakeVariantManager
                  groups={form.variantGroups}
                  basePrice={form.price}
                  onChange={(variantGroups) => patchForm({ variantGroups })}
                />
              </TabsContent>

              <TabsContent value="classification" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <AdminSelect
                      id="category"
                      value={form.categoryId}
                      onChange={(e) => patchForm({ categoryId: e.target.value })}
                    >
                      {adminCategories().map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </AdminSelect>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="flavour">Flavour</Label>
                    <AdminSelect
                      id="flavour"
                      value={form.flavourId ?? ""}
                      onChange={(e) =>
                        patchForm({ flavourId: e.target.value || undefined })
                      }
                    >
                      <option value="">Select flavour</option>
                      {adminFlavours().map((flavour) => (
                        <option key={flavour.id} value={flavour.id}>
                          {flavour.name}
                        </option>
                      ))}
                    </AdminSelect>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Occasions</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {adminOccasions().map((occasion) => (
                      <label
                        key={occasion.id}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={form.occasionIds.includes(occasion.id)}
                          onCheckedChange={(checked) =>
                            toggleOccasion(occasion.id, checked === true)
                          }
                        />
                        {occasion.name}
                      </label>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="commerce" className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.isEggless}
                      onCheckedChange={(checked) =>
                        patchForm({ isEggless: checked === true })
                      }
                    />
                    Eggless
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.isPhotoCake}
                      onCheckedChange={(checked) => {
                        const isPhotoCake = checked === true;
                        const hasPhotoGroup = form.variantGroups.some(
                          (group) => group.type === "photo"
                        );
                        patchForm({
                          isPhotoCake,
                          allowsPhotoUpload: isPhotoCake ? true : form.allowsPhotoUpload,
                          variantGroups:
                            isPhotoCake && !hasPhotoGroup
                              ? [
                                  ...form.variantGroups,
                                  createVariantGroup("Photo cake", "photo", [
                                    createVariantOption("Standard design", 0, true),
                                    createVariantOption("Custom photo print", 250, false),
                                  ], false),
                                ]
                              : form.variantGroups,
                        });
                      }}
                    />
                    Photo cake
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.isSeasonal}
                      onCheckedChange={(checked) =>
                        patchForm({ isSeasonal: checked === true })
                      }
                    />
                    Seasonal
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm sm:col-span-2">
                    <Checkbox
                      checked={form.unlimitedStock ?? false}
                      onCheckedChange={(checked) =>
                        patchForm({ unlimitedStock: checked === true })
                      }
                    />
                    Unlimited stock
                  </label>

                  <div className="space-y-2">
                    <Label htmlFor="stockQuantity">Stock quantity</Label>
                    <Input
                      id="stockQuantity"
                      type="number"
                      min={0}
                      disabled={form.unlimitedStock}
                      value={form.stockQuantity}
                      onChange={(e) =>
                        patchForm({ stockQuantity: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lowStockThreshold">Low stock threshold</Label>
                    <Input
                      id="lowStockThreshold"
                      type="number"
                      min={1}
                      disabled={form.unlimitedStock}
                      placeholder={`Default (${getInventorySettings().defaultLowStockThreshold})`}
                      value={form.lowStockThreshold ?? ""}
                      onChange={(e) =>
                        patchForm({
                          lowStockThreshold: e.target.value
                            ? Math.max(Number(e.target.value) || 1, 1)
                            : undefined,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Derived stock status</span>
                  <StockStatusBadge
                    status={deriveStockStatus(form, getInventorySettings())}
                    unlimited={form.unlimitedStock}
                    quantity={form.stockQuantity}
                    showQuantity
                  />
                </div>

                <div className="space-y-2">
                  <Label>Available shapes</Label>
                  <div className="flex flex-wrap gap-2">
                    {["Round", "Square", "Heart", "Rectangle"].map((shape) => (
                      <label
                        key={shape}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={form.shapes.includes(shape)}
                          onCheckedChange={(checked) =>
                            toggleShape(shape, checked === true)
                          }
                        />
                        {shape}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="flavourOptions">Flavour options (comma-separated)</Label>
                  <Input
                    id="flavourOptions"
                    value={form.flavourOptions.join(", ")}
                    onChange={(e) =>
                      patchForm({
                        flavourOptions: e.target.value
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Chocolate, Vanilla, Red Velvet"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.allowsMessage}
                      onCheckedChange={(checked) =>
                        patchForm({ allowsMessage: checked === true })
                      }
                    />
                    Allow cake message on PDP
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.allowsPhotoUpload}
                      onCheckedChange={(checked) =>
                        patchForm({ allowsPhotoUpload: checked === true })
                      }
                    />
                    Allow photo upload on PDP
                  </label>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rating">Rating (1–5)</Label>
                    <Input
                      id="rating"
                      type="number"
                      min={1}
                      max={5}
                      step={0.1}
                      value={form.rating}
                      onChange={(e) => patchForm({ rating: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reviewCount">Review count</Label>
                    <Input
                      id="reviewCount"
                      type="number"
                      min={0}
                      value={form.reviewCount}
                      onChange={(e) =>
                        patchForm({ reviewCount: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="media" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="imageUrl">Primary image URL</Label>
                  <Input
                    id="imageUrl"
                    value={form.images[0] ?? ""}
                    onChange={(e) => patchForm({ images: [e.target.value] })}
                    placeholder="https://images.unsplash.com/..."
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMediaPickerOpen(true)}
                  >
                    Browse Media Library
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Pick from uploaded media or paste an image URL.
                  </p>
                </div>
                {form.images[0] ? (
                  <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-xl border border-border bg-muted">
                    <SafeImage
                      src={form.images[0]}
                      alt={form.name || "Cake preview"}
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex aspect-square w-full max-w-xs items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
                    Image preview
                  </div>
                )}
              </TabsContent>

              <TabsContent value="seo" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="metaTitle">Meta title</Label>
                  <Input
                    id="metaTitle"
                    value={form.seo.metaTitle ?? ""}
                    onChange={(e) =>
                      patchForm({ seo: { ...form.seo, metaTitle: e.target.value } })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="metaDescription">Meta description</Label>
                  <textarea
                    id="metaDescription"
                    className={adminTextareaClassName}
                    value={form.seo.metaDescription ?? ""}
                    onChange={(e) =>
                      patchForm({ seo: { ...form.seo, metaDescription: e.target.value } })
                    }
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Publishing</CardTitle>
              <CardDescription>Status and merchandising flags</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <AdminSelect
                  id="status"
                  value={form.status}
                  onChange={(e) =>
                    patchForm({ status: e.target.value as EntityStatus })
                  }
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </AdminSelect>
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.isFeatured}
                    onCheckedChange={(checked) =>
                      patchForm({ isFeatured: checked === true })
                    }
                  />
                  Featured on homepage
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.isTrending}
                    onCheckedChange={(checked) =>
                      patchForm({ isTrending: checked === true })
                    }
                  />
                  Trending
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.isBestSeller}
                    onCheckedChange={(checked) =>
                      patchForm({ isBestSeller: checked === true })
                    }
                  />
                  Best seller
                </label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Product summary</CardTitle>
              <CardDescription>Bakery metadata & variants</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {form.barcode ? (
                <p>
                  <span className="text-muted-foreground">SKU:</span> {form.barcode}
                </p>
              ) : null}
              <p>
                <span className="text-muted-foreground">Variant groups:</span>{" "}
                {form.variantGroups.length}
              </p>
              {form.preparationTimeMinutes ? (
                <p>
                  <span className="text-muted-foreground">Prep:</span>{" "}
                  {form.preparationTimeMinutes} min
                </p>
              ) : null}
              {form.shelfLifeDays ? (
                <p>
                  <span className="text-muted-foreground">Shelf life:</span>{" "}
                  {form.shelfLifeDays} day{form.shelfLifeDays === 1 ? "" : "s"}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <p className="line-clamp-1 text-sm font-medium text-primary">
                {form.seo.metaTitle || form.name || "Cake title"}
              </p>
              <p className="text-xs text-green-700 dark:text-green-400">
                bakery.com/store/cakes/{form.slug || "cake-slug"}
              </p>
              <p className="line-clamp-3 text-xs text-muted-foreground">
                {form.seo.metaDescription ||
                  form.shortDescription ||
                  "Meta description preview will appear here."}
              </p>
              <Badge variant="outline">{form.status}</Badge>
            </CardContent>
          </Card>

          <Button variant="ghost" className="w-full" render={<Link href={routes.admin.cakes.list} />}>
            Back to cakes list
          </Button>
        </div>
      </div>

      <CakeMediaPicker
        open={mediaPickerOpen}
        onOpenChange={setMediaPickerOpen}
        onSelect={(url) => patchForm({ images: [url] })}
      />

      <AdminMobileActionBar className="xl:hidden">
        <Button variant="outline" onClick={openPreview} disabled={!form.slug}>
          <ExternalLink className="size-4" />
          Preview
        </Button>
        <Button variant="outline" disabled={isSaving} onClick={() => saveCake("draft")}>
          Save Draft
        </Button>
        <Button variant="bakery" disabled={isSaving} onClick={() => saveCake("published")}>
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          Publish
        </Button>
      </AdminMobileActionBar>
    </AdminPage>
  );
}
