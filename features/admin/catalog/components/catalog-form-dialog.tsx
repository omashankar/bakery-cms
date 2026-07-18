"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminSelect, adminTextareaClassName } from "@/features/admin/products/components/admin-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProductCategory, ProductFlavour, ProductOccasion } from "@/types/product";
import type { CatalogTab, CatalogWeightOption } from "@/types/catalog";
import { slugify } from "@/utils/slug";
import {
  createCategory,
  createFlavour,
  createOccasion,
  createWeightOption,
  getCategories,
  getFlavours,
  getOccasions,
  getWeightOptions,
  updateCategory,
  updateFlavour,
  updateOccasion,
  updateWeightOption,
} from "@/features/catalog/lib/catalog-repository";

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
  const isEdit = Boolean(itemId);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [cakeCount, setCakeCount] = useState(0);
  const [modifier, setModifier] = useState(0);
  const [serves, setServes] = useState("8–10");
  const [sortOrder, setSortOrder] = useState(1);

  useEffect(() => {
    if (!open) return;
    if (!itemId) {
      setName("");
      setSlug("");
      setDescription("");
      setImage("");
      setCakeCount(0);
      setModifier(0);
      setServes("8–10");
      setSortOrder(getWeightOptions().length + 1);
      return;
    }

    if (tab === "categories") {
      const item = getCategories().find((entry) => entry.id === itemId);
      if (item) {
        setName(item.name);
        setSlug(item.slug);
        setDescription(item.description ?? "");
        setImage(item.image ?? "");
        setCakeCount(item.cakeCount ?? 0);
      }
    } else if (tab === "flavours") {
      const item = getFlavours().find((entry) => entry.id === itemId);
      if (item) {
        setName(item.name);
        setSlug(item.slug);
      }
    } else if (tab === "occasions") {
      const item = getOccasions().find((entry) => entry.id === itemId);
      if (item) {
        setName(item.name);
        setSlug(item.slug);
      }
    } else {
      const item = getWeightOptions().find((entry) => entry.id === itemId);
      if (item) {
        setName(item.label);
        setModifier(item.modifier);
        setServes(item.serves);
        setSortOrder(item.sortOrder);
      }
    }
  }, [open, itemId, tab]);

  function handleSubmit() {
    if (tab === "weights") {
      if (!name.trim()) {
        toast.error("Label is required");
        return;
      }
      if (isEdit && itemId) {
        updateWeightOption(itemId, {
          label: name.trim(),
          modifier,
          serves: serves.trim(),
          sortOrder,
        });
        toast.success("Weight option updated");
      } else {
        createWeightOption({
          label: name.trim(),
          modifier,
          serves: serves.trim(),
          sortOrder,
        });
        toast.success("Weight option created");
      }
      onSaved();
      onOpenChange(false);
      return;
    }

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    const finalSlug = slug.trim() || slugify(name);

    if (tab === "categories") {
      const payload: Omit<ProductCategory, "id" | "createdAt" | "updatedAt"> = {
        name: name.trim(),
        slug: finalSlug,
        description: description.trim() || undefined,
        image: image.trim() || undefined,
        cakeCount,
      };
      if (isEdit && itemId) {
        updateCategory(itemId, payload);
        toast.success("Category updated");
      } else {
        createCategory(payload);
        toast.success("Category created");
      }
    } else if (tab === "flavours") {
      const payload: Omit<ProductFlavour, "id" | "createdAt" | "updatedAt"> = {
        name: name.trim(),
        slug: finalSlug,
      };
      if (isEdit && itemId) {
        updateFlavour(itemId, payload);
        toast.success("Flavour updated");
      } else {
        createFlavour(payload);
        toast.success("Flavour created");
      }
    } else {
      const payload: Omit<ProductOccasion, "id" | "createdAt" | "updatedAt"> = {
        name: name.trim(),
        slug: finalSlug,
      };
      if (isEdit && itemId) {
        updateOccasion(itemId, payload);
        toast.success("Occasion updated");
      } else {
        createOccasion(payload);
        toast.success("Occasion created");
      }
    }

    onSaved();
    onOpenChange(false);
  }

  const titles: Record<CatalogTab, string> = {
    categories: "Category",
    flavours: "Flavour",
    occasions: "Occasion",
    weights: "Weight Option",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit" : "Add"} {titles[tab]}
          </DialogTitle>
          <DialogDescription>
            Catalog data is used in cake forms, collections, and product weight pricing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="catalog-name">{tab === "weights" ? "Label" : "Name"}</Label>
            <Input
              id="catalog-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!isEdit && tab !== "weights") setSlug(slugify(e.target.value));
              }}
            />
          </div>

          {tab !== "weights" ? (
            <div className="space-y-2">
              <Label htmlFor="catalog-slug">Slug</Label>
              <Input id="catalog-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>
          ) : null}

          {tab === "categories" ? (
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
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="catalog-image">Image URL</Label>
                  <Input id="catalog-image" value={image} onChange={(e) => setImage(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="catalog-count">Cake count</Label>
                  <Input
                    id="catalog-count"
                    type="number"
                    min={0}
                    value={cakeCount}
                    onChange={(e) => setCakeCount(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
            </>
          ) : null}

          {tab === "weights" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="catalog-modifier">Price modifier (₹)</Label>
                <Input
                  id="catalog-modifier"
                  type="number"
                  value={modifier}
                  onChange={(e) => setModifier(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="catalog-serves">Serves</Label>
                <Input id="catalog-serves" value={serves} onChange={(e) => setServes(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="catalog-sort">Sort order</Label>
                <AdminSelect
                  id="catalog-sort"
                  value={String(sortOrder)}
                  onChange={(e) => setSortOrder(Number(e.target.value) || 1)}
                >
                  {Array.from({ length: 10 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {index + 1}
                    </option>
                  ))}
                </AdminSelect>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="bakery" onClick={handleSubmit}>
            {isEdit ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
