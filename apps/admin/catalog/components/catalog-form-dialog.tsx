"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { reportWrite } from "@/apps/admin/lib/report-write";
import { adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PhotoField } from "@/apps/admin/media/components/photo-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type {
  ProductCategory,
  ProductCollection,
  ProductOccasion,
} from "@/types/product";
import type { CatalogTab } from "@/types/catalog";
import { slugify } from "@/utils/slug";
import { findSlugClash } from "@/features/catalog/lib/catalog-utils";
import {
  createCategory,
  createCollection,
  createOccasion,
  getCategories,
  getCollections,
  getOccasions,
  updateCategory,
  updateCollection,
  updateOccasion,
} from "@/features/catalog/lib/catalog-repository";
import { loadProducts } from "@/features/products/lib/products-repository";
import { Checkbox } from "@/components/ui/checkbox";
import { useBusinessLabels } from "@/hooks/use-business-labels";

/**
 * Every row a new slug has to be unique against — THE ONES THAT SHARE ITS
 * ADDRESS, and no others.
 *
 * This used to be all three lists at once, and that was right when there was
 * one address space: /store/collections/<slug> resolved against categories,
 * occasions and collections alike, so two rows at one slug meant one page
 * answering for both and nothing anywhere saying why.
 *
 * Occasions have their own address now — /store/occasions/<slug> — and leaving
 * the check as it was made this shop's catalogue UNEDITABLE: the occasion
 * "Birthday" holds `/birthday`, so opening the category "Birthday Cakes" and
 * pressing Save answered "already used by Birthday" for a slug it had held all
 * along. Three of the four occasions collide that way, and the same for
 * wedding and anniversary on the category side.
 *
 * So the rule follows the addresses. Categories and collections still share
 * one — the collections route resolves a collection first, then a category —
 * and an occasion now only has to be unique among occasions.
 */
function existingSlugs(tab: CatalogTab): { id: string; name: string; slug: string }[] {
  if (tab === "occasions") return getOccasions();
  return [...getCategories(), ...getCollections()];
}

interface CatalogFormDialogProps {
  open: boolean;
  tab: CatalogTab;
  itemId?: string | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function CatalogFormDialog({
  open,
  tab,
  itemId,
  onOpenChange,
  onSaved,
}: CatalogFormDialogProps) {
  const labels = useBusinessLabels();
  const isEdit = Boolean(itemId);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [headline, setHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  /**
   * Whether the shop is offering this row at all.
   *
   * Starts TRUE for a new row and for a stored one that has never carried the
   * field — absent means on, everywhere that reads it, so a catalogue written
   * before this switch existed keeps showing everything it showed.
   */
  const [isActive, setIsActive] = useState(true);
  /** Collections only — ORDERED, because the order is the curation. */
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    if (!itemId) {
      setName("");
      setSlug("");
      setHeadline("");
      setDescription("");
      setImage("");
      setIsActive(true);
      setProductIds([]);
      setProductSearch("");
      return;
    }

    if (tab === "categories") {
      const item = getCategories().find((entry) => entry.id === itemId);
      if (item) {
        setName(item.name);
        setSlug(item.slug);
        setHeadline(item.headline ?? "");
        setDescription(item.description ?? "");
        setImage(item.image ?? "");
        setIsActive(item.isActive !== false);
      }

    } else if (tab === "occasions") {
      const item = getOccasions().find((entry) => entry.id === itemId);
      if (item) {
        setName(item.name);
        setSlug(item.slug);
        setHeadline(item.headline ?? "");
        setDescription(item.description ?? "");
        setImage(item.image ?? "");
        setIsActive(item.isActive !== false);
      }
    } else if (tab === "collections") {
      const item = getCollections().find((entry) => entry.id === itemId);
      if (item) {
        setName(item.name);
        setSlug(item.slug);
        setHeadline(item.headline ?? "");
        setDescription(item.description ?? "");
        setImage(item.image ?? "");
        setIsActive(item.isActive !== false);
        setProductIds(item.productIds ?? []);
      }
    }
  }, [open, itemId, tab]);

  async function handleSubmit() {

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    const finalSlug = slug.trim() || slugify(name);

    // `slugify` strips everything outside `[\w\s-]`, so a name written entirely
    // in a non-Latin script — मिठाई, 蛋糕 — produces an empty string. The server
    // rejects it, and because each section is a replace-all, that refusal
    // poisons every later save of the section until the page is reloaded. Say so
    // here, where the admin can fix it.
    if (!finalSlug) {
      toast.error("Add a URL slug", {
        description: "The name has no characters that can be used in a web address.",
      });
      return;
    }

    /**
     * Two rows may not claim the same slug.
     *
     * Nothing enforced this anywhere — the server schema asks only for
     * `min(1)`. And the failure is silent rather than loud:
     * `getStorefrontCategories` de-dupes by slug and keeps the FIRST row, so a
     * second one with the same slug is simply unreachable. Its products cannot
     * be browsed to, and there is no 404 and no error to notice. The shipped
     * taxonomy carried exactly that collision — two Seasonal categories — and
     * every fresh install and every "Reset defaults" reproduced it.
     *
     * The row being edited is excluded, or saving it without touching the slug
     * would refuse itself.
     */
    const clash = findSlugClash(existingSlugs(tab), finalSlug, itemId);
    if (clash) {
      toast.error(`"${finalSlug}" is already used by ${clash.name}`, {
        description:
          "Two entries with the same web address cannot both be reached — give this one a different slug.",
      });
      return;
    }

    if (tab === "categories") {
      const payload: Omit<ProductCategory, "id" | "createdAt" | "updatedAt"> = {
        name: name.trim(),
        slug: finalSlug,
        headline: headline.trim() || undefined,
        description: description.trim() || undefined,
        image: image.trim() || undefined,
        isActive,
      };
      if (isEdit && itemId) {
        const { persisted } = await updateCategory(itemId, payload);
        reportWrite(persisted, "Category updated");
      } else {
        const { persisted } = await createCategory(payload);
        reportWrite(persisted, "Category created");
      }

    } else if (tab === "collections") {
      const payload: Omit<ProductCollection, "id" | "createdAt" | "updatedAt"> = {
        name: name.trim(),
        slug: finalSlug,
        headline: headline.trim() || undefined,
        description: description.trim() || undefined,
        image: image.trim() || undefined,
        isActive,
        // Sent whatever it holds, including empty — a shop legitimately
        // names the group first and fills it second.
        productIds,
      };
      if (isEdit && itemId) {
        const { persisted } = await updateCollection(itemId, payload);
        reportWrite(persisted, "Collection updated");
      } else {
        const { persisted } = await createCollection(payload);
        reportWrite(persisted, "Collection created");
      }
    } else {
      const payload: Omit<ProductOccasion, "id" | "createdAt" | "updatedAt"> = {
        name: name.trim(),
        slug: finalSlug,
        headline: headline.trim() || undefined,
        description: description.trim() || undefined,
        image: image.trim() || undefined,
        isActive,
      };
      if (isEdit && itemId) {
        const { persisted } = await updateOccasion(itemId, payload);
        reportWrite(persisted, "Occasion updated");
      } else {
        const { persisted } = await createOccasion(payload);
        reportWrite(persisted, "Occasion created");
      }
    }

    onSaved();
    onOpenChange(false);
  }

  const titles: Record<CatalogTab, string> = {
    categories: labels.categoryWord,
    occasions: labels.occasionWord,
    collections: labels.collectionWord,
  };

  /**
   * Published first, then the rest — an owner curating a row is picking from
   * what is on the shop, and a draft in the list is a product the collection
   * would silently not show.
   */
  const pickable = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    return loadProducts()
      .filter(
        (product) =>
          !query ||
          product.name.toLowerCase().includes(query) ||
          product.slug.toLowerCase().includes(query),
      )
      .sort((a, b) => Number(b.status === "published") - Number(a.status === "published"));
  }, [productSearch]);

  /**
   * Ticking APPENDS, so the order of the list is the order they were chosen.
   *
   * That order is what the collection page renders in — it is the curation,
   * and it is the one thing about a collection that cannot be re-derived
   * later from anything else.
   */
  function toggleProduct(id: string, checked: boolean) {
    setProductIds((prev) =>
      checked ? [...prev, id] : prev.filter((item) => item !== id),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit" : "Add"} {titles[tab]}
          </DialogTitle>
          <DialogDescription>
            Catalog data is used in {labels.productWord.toLowerCase()} forms and collections.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="catalog-name">Name</Label>
            <Input
              id="catalog-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!isEdit) setSlug(slugify(e.target.value));
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="catalog-headline">Page heading (optional)</Label>
            <Input
              id="catalog-headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={name.trim() || "Leave blank to use the name above"}
            />
            <p className="text-xs text-muted-foreground">
              What the listing page is headed. Leave it blank and the name above
              is used.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="catalog-slug">Slug</Label>
            <Input id="catalog-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>

          {/*
            Description and picture belong to anything a customer LANDS on.

            This was gated on "not occasions", because an occasion was a tag
            rather than a page — true while it had no address of its own. It
            has one now, /store/occasions/<slug>, with a heading and a grid
            under it like the other two. So all three carry the same two
            fields and there is no gate left to keep in step.
          */}
          <>
              <div className="space-y-2">
                <Label htmlFor="catalog-description">Description</Label>
                <textarea
                  id="catalog-description"
                  className={adminTextareaClassName}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
              {/*
                * This field was a bare text box, and it is where the reported
                * crash came from: OurMenuSection renders `category.image`, and
                * with no Media button beside it, typing a URL from somewhere
                * else was the ONLY way to set a category picture. Every other
                * image field in the admin already had a picker.
                */}
              <PhotoField
                id="catalog-image"
                label="Image"
                value={image}
                onChange={setImage}
              />
              {/*
                A "Cake count" number box was here. It wrote to the database and
                was read by nobody: the one place that used to consume it now
                says "Counted, never declared" and counts the shop's actual
                published products instead — because a typed number OVERRODE the
                real catalogue, and the homepage advertised "48 cakes" under
                Birthday in a shop that held 25 products in total.

                Same treatment as the other controls that decided nothing:
                the input goes, the stored field stays.
              */}
          </>

          {/*
            SWITCHED OFF IS NOT DELETED.

            Deleting a category leaves every product filed under it pointing at
            an id nothing resolves — the confirm on the list behind this dialog
            says so, and three of this shop's products are already in that
            state. A shop that wants a row off its storefront for a season
            wants this instead, and until now had only the destructive one.

            Absent means ON wherever this is read, so a row stored before the
            switch existed keeps showing. Only an explicit off hides anything.
          */}
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Show on the shop</p>
              <p className="text-xs text-muted-foreground">
                Off hides it from the menu and from its own page. Nothing is
                deleted, and anything filed under it keeps its place.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/*
            THE ONE GENUINELY NEW CONTROL — filling a group from its own side.

            A category is chosen forty times, on forty product forms. A
            collection is the opposite: a shop putting together a Diwali row
            wants to sit here and tick. That is the whole reason a collection
            exists as a separate thing rather than being another category.

            The list is unpaginated on purpose. It is filtered by the search box
            above it, and a shop with enough products to make that a problem has
            a search box; a shop with twelve would have to page through three
            screens to build one row.
          */}
          {tab === "collections" ? (
            <div className="space-y-2">
              <Label htmlFor="collection-products">
                {labels.productWordPlural} in this collection
              </Label>
              <Input
                id="collection-products"
                placeholder={`Search ${labels.productWordPlural.toLowerCase()}…`}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {productIds.length === 0
                  ? "Nothing picked yet — the collection page will be empty."
                  : `${productIds.length} picked. They appear in the order you tick them.`}
              </p>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {pickable.length === 0 ? (
                  <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                    Nothing matches that search.
                  </p>
                ) : (
                  pickable.map((product) => (
                    <label
                      key={product.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox
                        checked={productIds.includes(product.id)}
                        onCheckedChange={(checked) =>
                          toggleProduct(product.id, checked === true)
                        }
                      />
                      <span className="min-w-0 flex-1 truncate">{product.name}</span>
                      {/* A draft in a collection is a product the page would
                          silently not show, so the row says so rather than
                          being hidden — hiding it makes the tick look lost. */}
                      {product.status !== "published" ? (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {product.status}
                        </span>
                      ) : null}
                    </label>
                  ))
                )}
              </div>
            </div>
          ) : null}

        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="bakery" onClick={() => void handleSubmit()}>
            {isEdit ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
