"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, RotateCcw, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader } from "@/features/admin/components";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { Switch } from "@/components/ui/switch";
import {
  deleteCoupons,
  loadCoupons,
  resetCoupons,
  toggleCouponActive,
  type StoredCoupon,
} from "../lib/coupons-repository";
import { CouponFormDialog } from "../components/coupon-form-dialog";

const PAGE_SIZE = 10;

export function CouponsAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [coupons, setCoupons] = useState<StoredCoupon[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  function refresh() {
    setCoupons(loadCoupons());
    setSelectedIds([]);
    setMounted(true);
  }

  useEffect(() => {
    refresh();
  }, []);

  const activeCount = coupons.filter((coupon) => coupon.isActive).length;
  const redemptionCount = coupons.reduce((sum, coupon) => sum + coupon.usageCount, 0);
  const totalPages = Math.max(1, Math.ceil(coupons.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => coupons.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [coupons, currentPage]
  );

  function handleDelete() {
    if (selectedIds.length === 0) return;
    const count = deleteCoupons(selectedIds);
    refresh();
    toast.success(`Deleted ${count} coupon${count === 1 ? "" : "s"}`);
  }

  function handleToggle(coupon: StoredCoupon) {
    toggleCouponActive(coupon.id);
    refresh();
    toast.success(coupon.isActive ? "Coupon deactivated" : "Coupon activated");
  }

  const description = !mounted
    ? "Manage discount codes used at storefront checkout."
    : coupons.length > 0
      ? `${activeCount} active · ${coupons.length} total · ${redemptionCount} redemptions`
      : "Manage discount codes used at storefront checkout.";

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Coupons"
        description={description}
        className="gap-3"
        actions={
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className="min-w-0 flex-1 sm:flex-none"
              onClick={() => {
                resetCoupons();
                refresh();
                toast.success("Coupons reset to defaults");
              }}
            >
              <RotateCcw className="size-4" />
              <span className="sm:hidden">Reset</span>
              <span className="hidden sm:inline">Reset defaults</span>
            </Button>
            <Button
              variant="bakery"
              className="min-w-0 flex-1 sm:flex-none"
              onClick={() => {
                setEditingId(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">Add coupon</span>
            </Button>
          </div>
        }
      />

      {selectedIds.length > 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-3">
          <p className="text-sm">{selectedIds.length} selected</p>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      ) : null}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">All coupons</CardTitle>
        </CardHeader>
        <CardContent>
          {coupons.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No coupons yet"
              description="Create your first discount code for the storefront."
              action={
                <Button
                  variant="bakery"
                  onClick={() => {
                    setEditingId(null);
                    setFormOpen(true);
                  }}
                >
                  Add coupon
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {paginated.map((coupon) => (
                <div
                  key={coupon.id}
                  className="flex flex-col gap-4 rounded-xl border border-border p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      className="mt-1"
                      checked={selectedIds.includes(coupon.id)}
                      onCheckedChange={() => {
                        setSelectedIds((prev) =>
                          prev.includes(coupon.id)
                            ? prev.filter((id) => id !== coupon.id)
                            : [...prev, coupon.id]
                        );
                      }}
                      aria-label={`Select ${coupon.code}`}
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm font-semibold">{coupon.code}</p>
                        <Badge variant="secondary">{coupon.label}</Badge>
                        {!coupon.isActive ? <Badge variant="outline">Inactive</Badge> : null}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{coupon.description}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {coupon.percentOff
                          ? `${coupon.percentOff}% off`
                          : coupon.flatOff
                            ? `₹${coupon.flatOff} off`
                            : "No discount configured"}
                        {coupon.minSubtotal ? ` · Min ${coupon.minSubtotal.toLocaleString("en-IN")}` : ""}
                        {` · Used ${coupon.usageCount} times`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                      <span className="text-xs text-muted-foreground">Active</span>
                      <Switch
                        checked={coupon.isActive}
                        onCheckedChange={() => handleToggle(coupon)}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(coupon.id);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
              {coupons.length > PAGE_SIZE ? (
                <ListPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <CouponFormDialog
        open={formOpen}
        editingId={editingId}
        onOpenChange={setFormOpen}
        onSaved={() => {
          refresh();
          setFormOpen(false);
        }}
      />
    </AdminPage>
  );
}
