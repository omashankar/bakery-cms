"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Flag,
  MessageSquare,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader, adminShell } from "@/features/admin/components";
import { AdminSelect } from "@/features/admin/products/components/admin-field";
import { loadProducts } from "@/features/products/lib/products-repository";
import {
  FilterPanel,
  FilterPanelSearch,
} from "@/components/shared/filter-panel";
import { StarRating } from "@/components/shared/star-rating";
import { EmptyState } from "@/components/shared/empty-state";
import { DashboardStatCard } from "@/features/admin/dashboard/components/dashboard-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ListPagination } from "@/components/shared/list-pagination";
import { routes } from "@/constants/routes";
import { formatRelativeTime } from "@/utils/format";
import type { ProductReview, ProductReviewFormData, ProductReviewOverview } from "@/types/review";
import {
  approveReviews,
  createReview,
  deleteReviews,
  loadReviews,
  rejectReviews,
  REVIEWS_UPDATED_EVENT,
  resetReviews,
  saveReviewReply,
  toggleReviewFeatured,
  updateReview,
} from "@/features/reviews/lib/reviews-repository";
import {
  defaultReviewFilters,
  filterReviews,
  getReviewOverview,
  type ReviewListFilters,
} from "@/features/reviews/lib/review-utils";
import { ReviewFormDialog } from "../components/review-form-dialog";
import { ReviewReplyDialog } from "../components/review-reply-dialog";
import { ReviewStatusBadge } from "../components/review-status-badge";

const PAGE_SIZE = 10;

const EMPTY_OVERVIEW: ProductReviewOverview = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  reported: 0,
  featured: 0,
  averageRating: 0,
};

export function ReviewsAdminPage() {
  const [mounted, setMounted] = useState(false);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [filters, setFilters] = useState<ReviewListFilters>(defaultReviewFilters);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<ProductReview | null>(null);
  const [replyReview, setReplyReview] = useState<ProductReview | null>(null);

  const cakes = useMemo(() => {
    if (!mounted) return [];
    return loadProducts().filter((cake) => cake.status === "published");
  }, [mounted, reviews.length]);

  const filtered = useMemo(() => filterReviews(reviews, filters), [reviews, filters]);
  const overview = useMemo(
    () => (mounted ? getReviewOverview(reviews) : EMPTY_OVERVIEW),
    [reviews, mounted]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const pageIds = paginated.map((review) => review.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  function refresh() {
    setReviews(loadReviews());
    setMounted(true);
  }

  useEffect(() => {
    refresh();
    window.addEventListener(REVIEWS_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(REVIEWS_UPDATED_EVENT, refresh);
  }, []);

  function updateFilters(patch: Partial<ReviewListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
    setSelectedIds([]);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectPage() {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
  }

  function handleSaveReview(data: ProductReviewFormData, id?: string) {
    if (id) {
      updateReview(id, data);
      toast.success("Review updated");
    } else {
      createReview(data);
      toast.success("Review added");
    }
    refresh();
    setSelectedIds([]);
  }

  function handleBulkApprove() {
    if (selectedIds.length === 0) return;
    const count = approveReviews(selectedIds);
    refresh();
    setSelectedIds([]);
    toast.success(`Approved ${count} review${count === 1 ? "" : "s"}`);
  }

  function handleBulkReject() {
    if (selectedIds.length === 0) return;
    const count = rejectReviews(selectedIds);
    refresh();
    setSelectedIds([]);
    toast.success(`Rejected ${count} review${count === 1 ? "" : "s"}`);
  }

  function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    const count = deleteReviews(selectedIds);
    refresh();
    setSelectedIds([]);
    toast.success(`Deleted ${count} review${count === 1 ? "" : "s"}`);
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Reviews"
        description="Moderate product reviews."
        className="gap-3"
        actions={
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className="min-w-0 flex-1 sm:flex-none"
              onClick={() => {
                resetReviews();
                refresh();
                toast.success("Reviews reset to demo seed");
              }}
            >
              <RotateCcw className="size-4" />
              <span className="sm:hidden">Reset</span>
              <span className="hidden sm:inline">Reset demo</span>
            </Button>
            <Button
              variant="bakery"
              className="min-w-0 flex-1 sm:flex-none"
              onClick={() => {
                setEditingReview(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">Add review</span>
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "pending", reportedOnly: false })}
        >
          <DashboardStatCard
            title="Pending"
            value={overview.pending}
            change={overview.pending > 0 ? "Needs moderation" : "All clear"}
            changeTone={overview.pending > 0 ? "warning" : "positive"}
            icon={MessageSquare}
            tone="gold"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ status: "reported", reportedOnly: false })}
        >
          <DashboardStatCard
            title="Reported"
            value={overview.reported}
            change={overview.reported > 0 ? "Needs review" : "None"}
            changeTone={overview.reported > 0 ? "warning" : "positive"}
            icon={Flag}
            tone="gold"
          />
        </button>
        <DashboardStatCard
          title="Avg rating"
          value={overview.averageRating || "—"}
          change="Approved only"
          changeTone="neutral"
          icon={Star}
          tone="bakery"
        />
      </section>

      <FilterPanel>
        <div className="space-y-3">
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search reviews, customers, products…"
          />
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <AdminSelect
              value={filters.status}
              onChange={(event) =>
                updateFilters({
                  status: event.target.value as ReviewListFilters["status"],
                  reportedOnly: false,
                })
              }
              aria-label="Review status"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="reported">Reported</option>
            </AdminSelect>
            <AdminSelect
              value={filters.rating}
              onChange={(event) =>
                updateFilters({
                  rating: event.target.value as ReviewListFilters["rating"],
                })
              }
              aria-label="Rating"
            >
              <option value="all">All ratings</option>
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </AdminSelect>
            <AdminSelect
              value={filters.productSlug}
              onChange={(event) => updateFilters({ productSlug: event.target.value })}
              aria-label="Product"
            >
              <option value="">All products</option>
              {cakes.map((cake) => (
                <option key={cake.id} value={cake.slug}>
                  {cake.name}
                </option>
              ))}
            </AdminSelect>
            <AdminSelect
              value={filters.featuredOnly ? "featured" : "all"}
              onChange={(event) =>
                updateFilters({ featuredOnly: event.target.value === "featured" })
              }
              aria-label="Featured filter"
            >
              <option value="all">All reviews</option>
              <option value="featured">Featured only</option>
            </AdminSelect>
          </div>
        </div>
      </FilterPanel>

      <section className={adminShell.tableCard}>
        {selectedIds.length > 0 ? (
          <div className="flex flex-col gap-2 border-b border-border px-3 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-4">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selected
            </span>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={handleBulkApprove}>
                <Check className="size-4" />
                Approve
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkReject}>
                <X className="size-4" />
                Reject
              </Button>
              <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="size-4" />
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                Clear
              </Button>
            </div>
          </div>
        ) : null}

        {paginated.length === 0 ? (
          <EmptyState
            icon={Star}
            title="No reviews found"
            description="Try another filter, or add a review manually."
            action={
              <Button
                variant="bakery"
                onClick={() => {
                  setEditingReview(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="size-4" />
                Add review
              </Button>
            }
            className="py-14"
          />
        ) : (
          <>
            <div className="hidden items-center gap-3 border-b border-border px-4 py-2 md:flex">
              <Checkbox
                checked={allPageSelected}
                onCheckedChange={toggleSelectPage}
                aria-label="Select all on page"
              />
              <span className="text-xs text-muted-foreground">Select page</span>
            </div>

            <ul className="divide-y divide-border">
              {paginated.map((review) => (
                <li key={review.id} className="p-3 sm:p-4">
                  <div className="flex gap-3">
                    <Checkbox
                      className="mt-1"
                      checked={selectedIds.includes(review.id)}
                      onCheckedChange={() => toggleSelect(review.id)}
                      aria-label={`Select review by ${review.authorName}`}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-foreground">{review.authorName}</p>
                        <ReviewStatusBadge status={review.status} />
                        {review.isFeatured ? (
                          <Badge variant="gold" className="text-[10px]">
                            Featured
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(review.createdAt)}
                        </span>
                      </div>

                      <StarRating rating={review.rating} size="sm" showValue />

                      <p className="text-sm font-medium">
                        <Link
                          href={routes.store.cake(review.productSlug)}
                          className="text-primary hover:underline"
                        >
                          {review.cakeName}
                        </Link>
                      </p>

                      {review.title ? (
                        <p className="max-w-2xl text-sm font-medium">{review.title}</p>
                      ) : null}
                      <p className="max-w-2xl text-sm text-muted-foreground">{review.body}</p>

                      {review.reportReason ? (
                        <p className="flex items-start gap-2 rounded-lg border border-red-200/80 bg-red-50 px-3 py-2 text-xs text-red-950 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-100">
                          <Flag className="mt-0.5 size-3.5 shrink-0" />
                          {review.reportReason}
                        </p>
                      ) : null}

                      {review.adminReply ? (
                        <div className="rounded-lg border border-border bg-muted/80 px-3 py-2 text-sm">
                          <p className="text-xs font-medium text-muted-foreground">
                            Bakery reply
                          </p>
                          <p className="mt-0.5 text-muted-foreground">{review.adminReply}</p>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {review.status !== "approved" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => {
                              approveReviews([review.id]);
                              refresh();
                              toast.success("Review approved");
                            }}
                          >
                            Approve
                          </Button>
                        ) : null}
                        {review.status !== "rejected" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => {
                              rejectReviews([review.id]);
                              refresh();
                              toast.success("Review rejected");
                            }}
                          >
                            Reject
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            toggleReviewFeatured(review.id);
                            refresh();
                            toast.success(review.isFeatured ? "Unfeatured" : "Featured");
                          }}
                        >
                          <Star className="size-3.5" />
                          {review.isFeatured ? "Unfeature" : "Feature"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => setReplyReview(review)}
                        >
                          <MessageSquare className="size-3.5" />
                          Reply
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={() => {
                            setEditingReview(review);
                            setFormOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {filtered.length > PAGE_SIZE ? (
              <div className="border-t border-border px-3 py-3 sm:px-4">
                <ListPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            ) : null}
          </>
        )}
      </section>

      <ReviewFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editingReview}
        onSubmit={handleSaveReview}
      />

      <ReviewReplyDialog
        review={replyReview}
        open={Boolean(replyReview)}
        onOpenChange={(open) => {
          if (!open) setReplyReview(null);
        }}
        onSave={(reviewId, reply) => {
          saveReviewReply(reviewId, reply);
          refresh();
          toast.success("Reply saved");
        }}
      />
    </AdminPage>
  );
}
