"use client";

import Link from "next/link";
import { PhotoField } from "@/apps/admin/media/components/photo-field";
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
import {
  DEFAULT_SIZE_AXIS_LABEL,
  weightAxisLabel,
} from "@/features/products/lib/product-pricing";
import { routes } from "@/constants/routes";
import { AdminMobileActionBar, AdminPage, AdminPageHeader } from "@/apps/admin/components";
import type { ProductFormData, EntityStatus } from "@/types";
import {
  adminCategories,
  adminFlavours,
  adminOccasions,
  getDefaultWeights,
  rederiveWeights,
} from "@/features/products/lib/catalog-options";
import { slugify } from "@/features/products/lib/product-utils";
import { createEmptyProductForm } from "@/features/products/lib/products-repository";
import {
  createProductRequest,
  fetchProduct,
  updateProductRequest,
} from "@/features/products/data/products-client";
import {
  deriveStockStatus,
  resolveStockFields,
} from "@/features/inventory/lib/inventory-utils";
import { StockStatusBadge } from "@/apps/admin/commerce/components/stock-status-badge";
import { resolveSaveStatus, type SaveIntent } from "@/lib/publishing/save-status";
import { formatStatusLabel } from "@/features/products/lib/product-utils";
import { getInventorySettings } from "@/apps/admin/commerce/lib/inventory-repository";
import { loadSeoStore, SEO_UPDATED_EVENT } from "@/features/seo/lib/seo-repository";
import { getActiveLocale } from "@/features/settings/lib/active-locale";
import type { ModuleSettings } from "@/types/settings";
import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import {
  getModuleSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { useBusinessLabels } from "@/hooks/use-business-labels";
import { AdminSelect, adminTextareaClassName } from "./admin-field";
import { ProductAttributesFields } from "./product-attributes-fields";
import { ProductDetailsFields } from "./product-details-fields";
import { ProductVariantManager } from "./product-variant-manager";
import {
  createVariantGroup,
  createVariantOption,
  getDefaultVariantSelections,
  setGroupDefaultBySemantic,
  syncLegacyFlagsFromVariants,
} from "@/features/products/lib/variant-utils";

interface ProductFormPageProps {
  mode: "add" | "edit";
  cakeId?: string;
}

/**
 * One photo replaced, the others left alone.
 *
 * Written out rather than done inline because the list is rendered from
 * `photoSlots`, which can be one slot longer than `form.images` — an empty box
 * for a photo not chosen yet. Indexing straight into `form.images` would drop
 * that write on the floor.
 */
export function withPhotoAt(images: string[], index: number, url: string): string[] {
  const next = [...images];
  while (next.length <= index) next.push("");
  next[index] = url;
  return next;
}

/** What the admin is told, per status actually written. */
const SAVED_MESSAGE: Record<EntityStatus, string> = {
  published: "Published — it is live on the shop",
  draft: "Saved as a draft — not on the shop yet",
  archived: "Archived — hidden from the shop",
};

export function ProductFormPage({ mode, cakeId }: ProductFormPageProps) {
  const router = useRouter();
  const [form, setForm] = useState<ProductFormData>(createEmptyProductForm);
  /**
   * Always at least one box, so a product with no photo yet has somewhere to
   * put the first one. Blank slots are dropped on submit — `handleSubmit`
   * already sends `images: form.images.filter(Boolean)`.
   */
  const photoSlots = form.images.length > 0 ? form.images : [""];
  /**
   * A write that reads the array it is changing, at the moment it changes it.
   *
   * `patchForm({ images: withPhotoAt(form.images, ...) })` captured `form.images`
   * when the row rendered. An upload takes seconds — shrink, then a round trip —
   * so its `onChange` fires long afterwards and put that stale copy back, wiping
   * any photo added to another row while it was in flight.
   */
  function setPhotoSlot(index: number, url: string) {
    setForm((prev) => ({ ...prev, images: withPhotoAt(prev.images, index, url) }));
  }

  /**
   * Removing a row EMPTIES it rather than closing the gap.
   *
   * Splicing renumbers every row below, and a row's identity here is its index —
   * for React's reconciliation and for an upload that has not landed yet. So
   * removing one row while another was uploading moved the pending upload onto
   * a different photo. Emptying keeps every other index exactly where it was.
   *
   * Trailing empties are dropped, so removing the last row still shrinks the
   * list, and blanks never reach the database: `handleSubmit` already sends
   * `images: form.images.filter(Boolean)`.
   */
  function removePhotoSlot(index: number) {
    setForm((prev) => {
      const next = withPhotoAt(prev.images, index, "");
      while (next.length > 0 && next[next.length - 1] === "") next.pop();
      return { ...prev, images: next };
    });
  }
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSaving, setIsSaving] = useState(false);
  /** The status the SERVER holds, which is the only one the storefront honours. */
  const [savedStatus, setSavedStatus] = useState<EntityStatus | null>(null);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  // Once the admin types a meta title of their own, the name stops driving it.
  // In edit mode the stored value is already theirs.
  const [metaTitleTouched, setMetaTitleTouched] = useState(mode === "edit");
  // Optional bakery modules hide fields from the form UI only — the underlying
  // form data is never dropped, so a hidden field keeps whatever it had.
  const [modules, setModules] = useState<ModuleSettings>(defaultModuleSettings);
  const labels = useBusinessLabels();
  const productLower = labels.productWord.toLowerCase();
  const productsLower = labels.productWordPlural.toLowerCase();

  /**
   * An archived cake is off the shop, and the two buttons say something
   * different about it. "Save Draft" over a retired cake is a lie twice: it
   * used to un-archive it, and even fixed it would be describing a state the
   * record is not in.
   */
  const isArchived = savedStatus === "archived";
  const saveLabel = isArchived ? "Save changes" : "Save Draft";
  const publishLabel = isArchived ? "Restore & publish" : "Publish";

  /**
   * The sizes the SHOP sells, as label + what each adds to a base price.
   *
   * Read here rather than in the render: `getDefaultWeights` goes through the
   * catalog repository, which reads localStorage and seeds it when it is cold,
   * and a render that writes is a render that can schedule its own next one.
   * `getDefaultWeights(0)` gives the modifier directly, so the price can be
   * re-derived from whatever the Price field says at the time.
   */
  const [catalogSizes, setCatalogSizes] = useState<
    { label: string; modifier: number; serves?: string }[]
  >([]);

  useEffect(() => {
    const sync = () => {
      setModules(getModuleSettings());
      setCatalogSizes(
        getDefaultWeights(0).map((tier) => ({
          label: tier.label,
          modifier: tier.price,
          serves: tier.serves,
        })),
      );
    };
    sync();
    window.addEventListener(SETTINGS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, sync);
  }, []);

  /**
   * The shop's own domain for the search-result preview.
   *
   * The card printed "bakery.com/store/cakes/<slug>" — a domain this shop does
   * not own, shown to every owner as the address their product would live at,
   * and the only occurrence of that literal in the app. SEO settings have held
   * `canonicalBaseUrl` all along.
   *
   * Read after mount rather than during render: `loadSeoStore` reads
   * localStorage, which the server cannot, and an empty first paint shows the
   * path alone rather than a wrong host.
   */
  const [previewOrigin, setPreviewOrigin] = useState("");
  useEffect(() => {
    const sync = () =>
      setPreviewOrigin((loadSeoStore().global.canonicalBaseUrl ?? "").replace(/\/+$/, ""));
    sync();
    // The base URL is edited on the SEO screen, which broadcasts its own event.
    // Subscribing means a form left open does not keep showing the old domain.
    window.addEventListener(SEO_UPDATED_EVENT, sync);
    return () => window.removeEventListener(SEO_UPDATED_EVENT, sync);
  }, []);

  useEffect(() => {
    if (mode !== "edit" || !cakeId) return;

    let cancelled = false;

    async function load() {
      try {
        const existing = await fetchProduct(cakeId as string);
        if (cancelled) return;
        const { id: _id, createdAt: _c, updatedAt: _u, ...data } = existing;
        setForm(data);
        setSavedStatus(data.status);
        setIsLoading(false);
      } catch {
        if (cancelled) return;
        toast.error(`${labels.productWord} not found`);
        router.replace(routes.admin.cakes.list);
      }
    }

    void load();
    // Guard against a late response landing after the user navigated away.
    return () => {
      cancelled = true;
    };
  }, [mode, cakeId, router]);

  function patchForm(patch: Partial<ProductFormData>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleNameChange(name: string) {
    setForm((prev) => ({
      ...prev,
      name,
      slug: slugTouched ? prev.slug : slugify(name),
      seo: {
        ...prev.seo,
        // Tracks the name until the admin edits the meta title themselves.
        //
        // This was `prev.seo.metaTitle || `${name} | Acme``, so the FIRST
        // keystroke made it truthy and the `||` short-circuited for every one
        // after: typing "Rose Truffle Delight" left the SEO tab, the search
        // preview card and the stored record all reading "R | Acme". The
        // brand was hard-coded too, in a CMS meant to run more than one shop.
        metaTitle: metaTitleTouched ? prev.seo.metaTitle : name,
      },
    }));
  }

  function handlePriceChange(price: number) {
    setForm((prev) => ({
      ...prev,
      price,
      // Only re-derive the tiers the admin has not priced by hand. Replacing
      // them wholesale meant editing the base price by one rupee silently
      // discarded every weight price that had been typed in — the tiers the
      // customer actually pays.
      weights: rederiveWeights(prev.weights, price, prev.price),
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

  /**
   * One row per size the shop sells, ticked where this product comes in it.
   *
   * A size the product carries whose Catalog preset has since been deleted
   * still gets a row, ticked and marked — it is a size this product is
   * genuinely sold in, and dropping it off the screen would delete it on the
   * next save without anybody being told.
   */
  const sizeRows = (() => {
    const chosen = new Map(form.weights.map((tier) => [tier.label, tier]));
    const rows = catalogSizes.map((size) => {
      const picked = chosen.get(size.label);
      return {
        label: size.label,
        serves: size.serves,
        selected: Boolean(picked),
        price: picked ? picked.price : form.price + size.modifier,
        retired: false,
      };
    });

    const known = new Set(catalogSizes.map((size) => size.label));
    for (const tier of form.weights) {
      if (known.has(tier.label)) continue;
      rows.push({
        label: tier.label,
        serves: tier.serves,
        selected: true,
        price: tier.price,
        retired: true,
      });
    }

    return rows;
  })();

  /**
   * Ticked sizes, kept in the order the rows are shown.
   *
   * Rebuilt from the rows rather than appended to, so a size ticked, unticked
   * and ticked again comes back where it belongs instead of at the end.
   */
  function toggleSize(label: string, selected: boolean) {
    setForm((prev) => {
      const kept = new Map(prev.weights.map((tier) => [tier.label, tier]));
      const next = sizeRows
        .filter((row) => (row.label === label ? selected : row.selected))
        .map((row) => {
          const existing = kept.get(row.label);
          return existing ?? { label: row.label, price: row.price, serves: row.serves };
        });
      return { ...prev, weights: next };
    });
  }

  function updateSizePrice(label: string, price: number) {
    setForm((prev) => ({
      ...prev,
      weights: prev.weights.map((tier) =>
        // Never below zero: the number input accepts a typed minus sign, and
        // a negative tier price is money off for choosing a bigger cake.
        tier.label === label ? { ...tier, price: Math.max(0, price) } : tier,
      ),
    }));
  }


  async function saveProduct(intent: SaveIntent, redirectToList = true) {
    if (!form.name.trim()) {
      toast.error("A name is required");
      return;
    }
    if (!form.slug.trim()) {
      toast.error("Slug is required");
      return;
    }

    setIsSaving(true);

    /**
     * Derived from the button's INTENT and from what the server holds — never
     * hardcoded by the caller. `status` used to be the caller's argument,
     * spread over `...form` below, which is why the Status dropdown beside
     * these buttons could not decide anything and why saving an archived cake
     * put it back on the shop.
     */
    const status = resolveSaveStatus(intent, savedStatus);

    const payload: ProductFormData = {
      ...form,
      name: form.name.trim(),
      slug: slugify(form.slug),
      status,
      images: form.images.filter(Boolean),
      ...resolveStockFields(form),
      ...syncLegacyFlagsFromVariants(
        form.variantGroups,
        getDefaultVariantSelections(form.variantGroups),
        // Without the form's own flags, a product with no egg variant group
        // had its "Eggless" tick overwritten with false on every save.
        { isEggless: form.isEggless, isPhotoCake: form.isPhotoCake },
      ),
    };

    try {
      if (mode === "add") {
        await createProductRequest(payload);
        toast.success(SAVED_MESSAGE[status]);
      } else if (cakeId) {
        await updateProductRequest(cakeId, payload);
        setSavedStatus(payload.status);
        // The form's own copy too, so the badge and the button labels cannot
        // disagree with what the server was just told.
        setForm(payload);
        toast.success(SAVED_MESSAGE[status]);
      }
    } catch (error) {
      // Keep the user on the form with their input intact so they can retry.
      toast.error(
        error instanceof Error ? error.message : `Could not save this ${productLower}`,
      );
      return;
    } finally {
      setIsSaving(false);
    }

    if (redirectToList) router.push(routes.admin.cakes.list);
  }

  /**
   * Open the cake as a customer sees it.
   *
   * The storefront route serves published products only, so this opened a 404
   * for every draft and for anything not yet saved — a button labelled Preview
   * that could not preview the two things an admin most wants to check. The
   * admin preview screen renders the same product from the server and works for
   * both, so an unpublished cake goes there instead.
   */
  function openPreview() {
    if (!form.slug) {
      toast.error("Add a slug before previewing");
      return;
    }

    if (mode === "add" || !cakeId) {
      toast.error(`Save the ${productLower} first`, {
        description: "There is nothing to preview until it exists.",
      });
      return;
    }

    /**
     * The SERVER's status, not the dropdown's.
     *
     * `form.status` is the unsaved value, so switching the dropdown to
     * "Published" and pressing Preview before saving opened
     * /store/cakes/<slug> for a product the server still holds as a draft —
     * the shop's own 404, from the admin's preview button.
     */
    if (savedStatus !== "published") {
      // A draft has no public page; show the admin preview rather than a 404.
      router.push(routes.admin.cakes.preview(cakeId));
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

  const title = mode === "add" ? `Add ${labels.productWord}` : `Edit ${labels.productWord}`;
  const previewUrl = `${previewOrigin}${routes.store.cake(form.slug || "product-slug")}`;

  return (
    <AdminPage className="space-y-4 sm:space-y-5 pb-20 xl:pb-0">
      <AdminPageHeader
        title={title}
        description={
          mode === "add"
            ? `Create a ${productLower} with pricing, commerce options, classification, and SEO.`
            : `Update ${productLower} details, stock, customization options, and publishing status.`
        }
        actions={
          <div className="hidden flex-wrap items-center gap-2 xl:flex">
            <Button variant="outline" onClick={openPreview} disabled={!form.slug}>
              <ExternalLink className="size-4" />
              Preview
            </Button>
            <Button variant="outline" disabled={isSaving} onClick={() => saveProduct("save")}>
              {saveLabel}
            </Button>
            <Button variant="bakery" disabled={isSaving} onClick={() => saveProduct("publish")}>
              {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              {publishLabel}
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
                {/*
                  "Options" third, not "Variants" fourth.
                  This is the tab that answers what most shops actually need —
                  a size, a colour, a capacity — and it sat behind "Details",
                  which is seven food fields. "Variant" is a word a developer
                  chose; "Options" is what the customer is being asked for.
                */}
                <TabsTrigger value="variants">Options</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="classification">Classification</TabsTrigger>
                <TabsTrigger value="commerce">Commerce</TabsTrigger>
                <TabsTrigger value="media">Media</TabsTrigger>
                <TabsTrigger value="seo">SEO</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{labels.productWord} name</Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Chocolate Truffle Cake, 65W Type-C Charger"
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
                    placeholder="chocolate-truffle-cake"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shortDescription">Short description</Label>
                  <Input
                    id="shortDescription"
                    value={form.shortDescription ?? ""}
                    onChange={(e) => patchForm({ shortDescription: e.target.value })}
                    placeholder="One line, shown in Google results"
                  />
                  {/*
                    The placeholder said "One-line summary for cards" and no card
                    rendered it — nothing did. It is now the meta description
                    this cake's page ships when the SEO tab is left blank, which
                    is a real destination, so the hint says that instead.
                  */}
                  <p className="text-xs text-muted-foreground">
                    Used as the search-result description when the SEO tab is empty.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Full description</Label>
                  <textarea
                    id="description"
                    className={adminTextareaClassName}
                    value={form.description}
                    onChange={(e) => patchForm({ description: e.target.value })}
                    placeholder="What it is, what makes it good, anything a buyer should know..."
                  />
                </div>
              </TabsContent>

              <TabsContent value="pricing" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="price">Base price ({getActiveLocale().currency})</Label>
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
                {modules.weight ? (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      {/*
                        The heading was the literal “Weight variants” here and
                        the literal “Weight” over the customer's buttons, while
                        every OTHER option group on both screens has been named
                        by the shop since variant groups existed. A shop selling
                        t-shirts had no way to say “Size”.
                      */}
                      <p className="text-sm font-medium">
                        {weightAxisLabel(form.weightLabel)} options
                      </p>
                      <div className="space-y-2">
                        <Label htmlFor="weightLabel">What customers see this called</Label>
                        <Input
                          id="weightLabel"
                          value={form.weightLabel ?? ""}
                          placeholder={DEFAULT_SIZE_AXIS_LABEL}
                          onChange={(e) => patchForm({ weightLabel: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          The heading above these buttons on the product page — Weight,
                          Size, Length, Capacity. Leave it blank for
                          “{DEFAULT_SIZE_AXIS_LABEL}”.
                        </p>
                      </div>
                      {/*
                        ONE ROW PER SIZE THE SHOP SELLS, ticked where this
                        product comes in it.

                        The choice used to be all of them or none: a button
                        that dumped every Catalog preset in, and another that
                        cleared the lot. A shop whose Ring Ceremony cake comes
                        in 0.5 and 1 kg only had no way to say so — and even if
                        it deleted the rest by hand, `rederiveWeights` put them
                        straight back on the next keystroke in the Price field.

                        Ticking is the whole interaction now. The price starts
                        at what the Catalog preset derives from this product's
                        base price, and the shop overrides it where it wants to.
                      */}
                      {sizeRows.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No sizes in Catalog yet. Add them under Catalog →{" "}
                          {weightAxisLabel(form.weightLabel)} and they will appear here.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {sizeRows.map((row) => (
                            <div
                              key={row.label}
                              className="grid items-center gap-3 rounded-lg border border-border px-3 py-3 sm:grid-cols-[1fr_140px]"
                            >
                              <label className="flex cursor-pointer items-start gap-2">
                                <Checkbox
                                  className="mt-0.5"
                                  checked={row.selected}
                                  onCheckedChange={(checked) =>
                                    toggleSize(row.label, checked === true)
                                  }
                                />
                                <span>
                                  <span className="block text-sm font-medium">{row.label}</span>
                                  {row.serves ? (
                                    <span className="block text-xs text-muted-foreground">
                                      Serves {row.serves}
                                    </span>
                                  ) : null}
                                  {row.retired ? (
                                    <span className="block text-xs text-muted-foreground">
                                      Not in Catalog any more — untick to stop selling it.
                                    </span>
                                  ) : null}
                                </span>
                              </label>
                              {row.selected ? (
                                <div className="space-y-1">
                                  <Label htmlFor={`weight-${row.label}`}>
                                    Price ({getActiveLocale().currency})
                                  </Label>
                                  <Input
                                    id={`weight-${row.label}`}
                                    type="number"
                                    min={0}
                                    value={row.price}
                                    onChange={(e) =>
                                      updateSizePrice(row.label, Number(e.target.value) || 0)
                                    }
                                  />
                                </div>
                              ) : null}
                            </div>
                          ))}
                          <p className="text-xs text-muted-foreground">
                            Tick every size this {productLower} is sold in. None ticked
                            means it is sold in one size, and the customer is shown no
                            picker at all.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                ) : null}
              </TabsContent>

              <TabsContent value="details" className="space-y-6">
                {/*
                  The shop's OWN facts come first. What follows them is six fixed
                  food fields — prep time, shelf life, calories, allergens, care
                  instructions — which are right for a bakery and dead space for a
                  charger. Putting the generic editor above them is what makes the
                  tab usable by a shop that sells neither cake nor anything edible.
                */}
                <ProductAttributesFields
                  value={form.attributes ?? []}
                  onChange={(attributes) => patchForm({ attributes })}
                />
                <Separator />
                <ProductDetailsFields
                  value={form}
                  onChange={(patch) => patchForm(patch)}
                />
              </TabsContent>

              <TabsContent value="variants" className="space-y-4">
                <ProductVariantManager
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
                  {modules.flavour ? (
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
                  ) : null}
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
                  {modules.eggEggless ? (
                    <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                      <Checkbox
                        checked={form.isEggless}
                        onCheckedChange={(checked) => {
                          const isEggless = checked === true;
                          // Move the egg group's default too, so the variant data
                          // agrees with the toggle. Without this the derived flag
                          // overwrites the tick on save.
                          patchForm({
                            isEggless,
                            variantGroups: setGroupDefaultBySemantic(
                              form.variantGroups,
                              "egg",
                              "eggless",
                              isEggless
                            ),
                          });
                        }}
                      />
                      Eggless
                    </label>
                  ) : null}
                  {modules.photoCake ? (
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <Checkbox
                      checked={form.isPhotoCake}
                      onCheckedChange={(checked) => {
                        const isPhotoCake = checked === true;
                        const hasPhotoGroup = form.variantGroups.some(
                          (group) => group.type === "photo"
                        );
                        // isPhotoCake is derived from whether a photo-print option
                        // is offered, so the group must be added AND removed in
                        // step with the toggle — otherwise the derived value
                        // overwrites the merchant's choice on save.
                        const variantGroups = isPhotoCake
                          ? hasPhotoGroup
                            ? form.variantGroups
                            : [
                                ...form.variantGroups,
                                createVariantGroup(
                                  "Photo cake",
                                  "photo",
                                  [
                                    createVariantOption("Standard design", 0, true),
                                    createVariantOption(
                                      "Custom photo print",
                                      250,
                                      false,
                                      "photo-print"
                                    ),
                                  ],
                                  false
                                ),
                              ]
                          : form.variantGroups.filter((group) => group.type !== "photo");

                        patchForm({
                          isPhotoCake,
                          allowsPhotoUpload: isPhotoCake ? true : form.allowsPhotoUpload,
                          variantGroups,
                        });
                      }}
                    />
                    Photo cake
                  </label>
                  ) : null}
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

                {/*
                  The four hardcoded shape checkboxes — Round, Square, Heart,
                  Rectangle — are gone. They wrote a list of NAMES with nowhere
                  to put a price, so a shop could offer a Heart and could not
                  charge for it, and a shop wanting any other shape had no way
                  to say so. Shapes are a variant group in the Options tab now,
                  with a price on each.
                */}

                {modules.flavour ? (
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
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.allowsMessage}
                      onCheckedChange={(checked) =>
                        patchForm({ allowsMessage: checked === true })
                      }
                    />
                    Allow {productLower} message on PDP
                  </label>
                  {modules.photoCake ? (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={form.allowsPhotoUpload}
                        onCheckedChange={(checked) =>
                          patchForm({ allowsPhotoUpload: checked === true })
                        }
                      />
                      Allow photo upload on PDP
                    </label>
                  ) : null}
                </div>

                {/*
                  Shown, not edited.

                  Both were editable number inputs whose values `updateProduct`
                  deliberately re-imposes from the stored record — its comment
                  says so: they are "owned by the reviews aggregate". So the
                  admin typed a rating, pressed Save, read "Cake updated &
                  published", and the number went back to what it was. The one
                  thing the form must not do is invite a change it discards.
                */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="rating">Rating</Label>
                    <Input id="rating" value={form.rating || "No reviews yet"} readOnly disabled />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reviewCount">Review count</Label>
                    <Input id="reviewCount" value={form.reviewCount} readOnly disabled />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Set by customer reviews. Moderate them under Commerce → Reviews.
                </p>
              </TabsContent>

              <TabsContent value="media" className="space-y-4">
                {/*
                  One box wrote `images: [url]`, so a shop could store exactly
                  one photo — while the type, the database, the validator and this
                  form's own submit (`images: form.images.filter(Boolean)`) had all
                  handled an array from the start. The product page's thumbnail
                  rail renders on `images.length > 1` and had therefore never
                  appeared for anybody.
                */}
                {photoSlots.map((url, index) => (
                  <div key={index} className="space-y-2">
                    <PhotoField
                      id={index === 0 ? "imageUrl" : `imageUrl-${index}`}
                      label={index === 0 ? "Main photo" : `Photo ${index + 1}`}
                      aspect="square"
                      value={url}
                      onChange={(next) => setPhotoSlot(index, next)}
                      placeholder="https://images.unsplash.com/..."
                    />
                    {photoSlots.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePhotoSlot(index)}
                      >
                        Remove this photo
                      </Button>
                    ) : null}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((prev) => ({
                    ...prev,
                    images: [...(prev.images.length > 0 ? prev.images : [""]), ""],
                  }))}
                >
                  Add another photo
                </Button>
                <p className="text-xs text-muted-foreground">
                  The first photo is the one customers see on cards and in search,
                  and the one that appears when somebody shares the link. The rest
                  become thumbnails on the product page.
                </p>
              </TabsContent>

              <TabsContent value="seo" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="metaTitle">Meta title</Label>
                  <Input
                    id="metaTitle"
                    value={form.seo.metaTitle ?? ""}
                    onChange={(e) => {
                      setMetaTitleTouched(true);
                      patchForm({ seo: { ...form.seo, metaTitle: e.target.value } });
                    }}
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
              {/*
                Status is REPORTED here, not chosen.

                This was a dropdown, and it could not set anything: every save
                took its status from the button that was pressed, spread over
                the form's own copy, so whichever of Save/Publish the admin
                pressed overrode whatever they had picked. "Archived" was the
                clearest proof — no save path in the app could produce it, so
                the option existed only to be ignored.

                Two labelled buttons already say what a save does. A third
                control claiming the same job could only ever be the one that
                loses, so it is gone, and Archive — the thing the dropdown was
                really being asked for — is a real action below.
              */}
              <div className="space-y-2">
                <span className="text-sm font-medium">Status</span>
                <div className="flex items-center gap-2">
                  <Badge variant={savedStatus === "published" ? "success" : "outline"}>
                    {formatStatusLabel(savedStatus ?? "draft")}
                  </Badge>
                  {mode === "edit" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-muted-foreground"
                      disabled={isSaving}
                      onClick={() => saveProduct(isArchived ? "unarchive" : "archive", false)}
                    >
                      {isArchived ? "Restore as draft" : "Archive"}
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isArchived
                    ? "Hidden from the shop. Restoring brings it back as a draft."
                    : "Set by the Save and Publish buttons above."}
                </p>
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
              <CardTitle className="text-base">{labels.productWord} summary</CardTitle>
              <CardDescription>Stock, options and classification</CardDescription>
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
                {form.seo.metaTitle || form.name || `${labels.productWord} title`}
              </p>
              {/*
                The shop's own domain, not "bakery.com" — the one place in the
                app that literal appeared, shown to every owner as the address
                their product would live at.
              */}
              <p className="text-xs text-green-700 dark:text-green-400">
                {previewUrl}
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
            Back to {productsLower} list
          </Button>
        </div>
      </div>

      <AdminMobileActionBar className="xl:hidden">
        <Button variant="outline" onClick={openPreview} disabled={!form.slug}>
          <ExternalLink className="size-4" />
          Preview
        </Button>
        <Button variant="outline" disabled={isSaving} onClick={() => saveProduct("save")}>
          {saveLabel}
        </Button>
        <Button variant="bakery" disabled={isSaving} onClick={() => saveProduct("publish")}>
          {isSaving ? <Loader2 className="size-4 animate-spin" /> : null}
          {publishLabel}
        </Button>
      </AdminMobileActionBar>
    </AdminPage>
  );
}
