"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FolderInput,
  Grid3x3,
  HardDrive,
  ImageIcon,
  Images,
  LayoutList,
  Trash2,
  Upload,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/features/admin/cakes/components/admin-field";
import {
  FilterPanel,
  FilterPanelSearch,
  FilterPanelToolbar,
} from "@/components/shared/filter-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { MobileDetailDrawer } from "@/components/shared/mobile-detail-drawer";
import { DashboardStatCard } from "@/features/admin/dashboard/components/dashboard-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/utils/format";
import type { MediaFile } from "@/types/media";
import {
  bulkMoveMediaToFolder,
  countMediaUsage,
  deleteMediaFiles,
  getMediaStats,
  loadMediaFiles,
  MEDIA_UPDATED_EVENT,
} from "../lib/media-repository";
import { loadMediaFolders } from "../lib/media-folders";
import {
  defaultMediaFilters,
  filterMedia,
  collectMediaTags,
  findDuplicateMediaGroups,
  formatFileSize,
  getUnusedMediaFiles,
  type MediaListFilters,
} from "../lib/media-utils";
import { DeleteMediaDialog } from "./delete-media-dialog";
import { MediaDetailPanel } from "./media-detail-panel";
import { MediaFolderSidebar } from "./media-folder-sidebar";
import { MediaMoveDialog } from "./media-move-dialog";
import { MediaThumbnail } from "./media-thumbnail";
import { MediaToolsDialog } from "./media-tools-dialog";
import { MediaUploadDialog } from "./media-upload-dialog";
import { AdminPage, AdminPageHeader, adminShell } from "@/features/admin/components";

const PAGE_SIZE = 12;

const EMPTY_STATS = {
  total: 0,
  images: 0,
  videos: 0,
  totalBytes: 0,
  unused: 0,
};

export function MediaLibraryPage() {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [folders, setFolders] = useState<ReturnType<typeof loadMediaFolders>>([]);
  const [ready, setReady] = useState(false);
  const [filters, setFilters] = useState<MediaListFilters>(defaultMediaFilters);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveFolderId, setMoveFolderId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    ids: string[];
    name?: string;
    inUse?: boolean;
  } | null>(null);

  const filtered = useMemo(() => filterMedia(files, filters), [files, filters]);
  const stats = useMemo(
    () => (ready ? getMediaStats(files) : EMPTY_STATS),
    [files, ready]
  );
  const availableTags = useMemo(() => collectMediaTags(files), [files]);
  const duplicateGroups = useMemo(() => findDuplicateMediaGroups(files), [files]);
  const unusedCount = useMemo(() => getUnusedMediaFiles(files).length, [files]);
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = { all: files.length };
    for (const folder of folders) {
      counts[folder.id] = files.filter((file) => file.folderId === folder.id).length;
    }
    return counts;
  }, [files, folders]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedFile = files.find((file) => file.id === selectedId) ?? null;

  const pageIds = paginated.map((file) => file.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  const filtersActive =
    filters.search.trim() !== "" ||
    filters.type !== "all" ||
    filters.usage !== "all" ||
    filters.tag !== "all" ||
    filters.date !== "all" ||
    filters.sort !== "newest" ||
    filters.folderId !== "all";

  function refresh() {
    const nextFolders = loadMediaFolders();
    setFiles(loadMediaFiles());
    setFolders(nextFolders);
    setMoveFolderId((current) => current || nextFolders[0]?.id || "");
  }

  useEffect(() => {
    refresh();
    setReady(true);

    function handleMediaUpdated() {
      refresh();
    }

    window.addEventListener(MEDIA_UPDATED_EVENT, handleMediaUpdated);
    return () => window.removeEventListener(MEDIA_UPDATED_EVENT, handleMediaUpdated);
  }, []);

  function updateFilters(patch: Partial<MediaListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleSelectAllPage() {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...pageIds])]);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const count = deleteMediaFiles(deleteTarget.ids);
    refresh();
    setSelectedIds((prev) => prev.filter((id) => !deleteTarget.ids.includes(id)));
    if (selectedId && deleteTarget.ids.includes(selectedId)) setSelectedId(null);
    toast.success(`${count} file${count === 1 ? "" : "s"} deleted`);
    setDeleteTarget(null);
  }

  function confirmMove() {
    const count = bulkMoveMediaToFolder(selectedIds, moveFolderId);
    refresh();
    toast.success(`Moved ${count} file${count === 1 ? "" : "s"}`);
    setSelectedIds([]);
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Media Library"
        description="Upload and organize images for cakes, banners, and builders."
        className="gap-3"
        actions={
          <div className="flex w-full gap-2">
            <Button
              variant="outline"
              className="min-w-0 flex-1 sm:flex-none"
              onClick={() => setToolsOpen(true)}
            >
              <Wrench className="size-4" />
              Tools
              {duplicateGroups.length > 0 ? (
                <Badge variant="secondary" className="ml-1">
                  {duplicateGroups.length}
                </Badge>
              ) : null}
            </Button>
            <Button
              variant="bakery"
              className="min-w-0 flex-1 sm:flex-none"
              onClick={() => setUploadOpen(true)}
            >
              <Upload className="size-4" />
              Upload
            </Button>
          </div>
        }
      />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ type: "all", usage: "all", folderId: "all" })}
        >
          <DashboardStatCard
            title="Total files"
            value={stats.total}
            change="All media"
            changeTone="neutral"
            icon={Images}
            tone="bakery"
          />
        </button>
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ type: "image" })}
        >
          <DashboardStatCard
            title="Images"
            value={stats.images}
            change="Image files"
            changeTone="positive"
            icon={ImageIcon}
            tone="bakery"
          />
        </button>
        <DashboardStatCard
          title="Storage"
          value={formatFileSize(stats.totalBytes)}
          change="Library size"
          changeTone="neutral"
          icon={HardDrive}
          tone="neutral"
        />
        <button
          type="button"
          className="h-full w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => updateFilters({ usage: "unused" })}
        >
          <DashboardStatCard
            title="Unused"
            value={stats.unused}
            change={stats.unused > 0 ? "Not referenced" : "All in use"}
            changeTone={stats.unused > 0 ? "warning" : "positive"}
            icon={Trash2}
            tone={stats.unused > 0 ? "gold" : "neutral"}
          />
        </button>
      </section>

      <FilterPanel>
        <FilterPanelToolbar>
          <FilterPanelSearch
            value={filters.search}
            onChange={(value) => updateFilters({ search: value })}
            placeholder="Search by filename or alt text…"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <AdminSelect
                value={filters.type}
                onChange={(e) =>
                  updateFilters({ type: e.target.value as MediaListFilters["type"] })
                }
              >
                <option value="all">All types</option>
                <option value="image">Images</option>
                <option value="video">Videos</option>
              </AdminSelect>
              <AdminSelect
                value={filters.usage}
                onChange={(e) =>
                  updateFilters({ usage: e.target.value as MediaListFilters["usage"] })
                }
              >
                <option value="all">All usage</option>
                <option value="used">Used</option>
                <option value="unused">Unused</option>
              </AdminSelect>
              <AdminSelect
                value={filters.tag}
                onChange={(e) => updateFilters({ tag: e.target.value })}
              >
                <option value="all">All tags</option>
                {availableTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </AdminSelect>
              <AdminSelect
                value={filters.date}
                onChange={(e) =>
                  updateFilters({ date: e.target.value as MediaListFilters["date"] })
                }
              >
                <option value="all">All dates</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </AdminSelect>
              <AdminSelect
                value={filters.sort}
                onChange={(e) =>
                  updateFilters({ sort: e.target.value as MediaListFilters["sort"] })
                }
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="name">Name</option>
              </AdminSelect>
            </div>
            <div className="flex shrink-0 rounded-xl border border-border bg-card p-1">
              <Button
                variant={view === "grid" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setView("grid")}
                aria-label="Grid view"
              >
                <Grid3x3 className="size-4" />
              </Button>
              <Button
                variant={view === "list" ? "secondary" : "ghost"}
                size="icon"
                onClick={() => setView("list")}
                aria-label="List view"
              >
                <LayoutList className="size-4" />
              </Button>
            </div>
          </div>
        </FilterPanelToolbar>

        {filtersActive ? (
          <div className="mt-3 flex justify-end border-t border-border pt-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilters(defaultMediaFilters);
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : null}

        {selectedIds.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} selected
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setMoveFolderId(folders[0]?.id ?? "");
                setMoveOpen(true);
              }}
            >
              <FolderInput className="size-4" />
              Move
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                setDeleteTarget({
                  ids: selectedIds,
                  inUse: selectedIds.some((id) => {
                    const file = files.find((item) => item.id === id);
                    return file ? countMediaUsage(file.url) > 0 : false;
                  }),
                })
              }
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
              Clear selection
            </Button>
          </div>
        ) : null}
      </FilterPanel>

      {/* Mobile folder chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 xl:hidden">
        <button
          type="button"
          onClick={() => updateFilters({ folderId: "all" })}
          className={cn(
            "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
            filters.folderId === "all"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-card text-muted-foreground"
          )}
        >
          All ({folderCounts.all ?? 0})
        </button>
        {folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            onClick={() => updateFilters({ folderId: folder.id })}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium",
              filters.folderId === folder.id
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card text-muted-foreground"
            )}
          >
            {folder.name} ({folderCounts[folder.id] ?? 0})
          </button>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_minmax(260px,320px)]">
        <div className="hidden xl:block">
          <MediaFolderSidebar
            folders={folders}
            activeFolderId={filters.folderId}
            counts={folderCounts}
            onSelect={(folderId) => updateFilters({ folderId })}
            onFoldersChange={refresh}
          />
        </div>

        <div className="space-y-4">
          {!ready ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="aspect-square animate-pulse rounded-xl border border-border bg-muted"
                />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="No media files found"
              description={
                filtersActive
                  ? "Try adjusting your filters or search."
                  : "Upload your first image to get started."
              }
              action={
                !filtersActive ? (
                  <Button variant="bakery" onClick={() => setUploadOpen(true)}>
                    <Upload className="size-4" />
                    Upload
                  </Button>
                ) : undefined
              }
            />
          ) : view === "grid" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allPageSelected}
                  onCheckedChange={toggleSelectAllPage}
                  aria-label="Select all on page"
                />
                <span className="text-xs text-muted-foreground">Select page</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {paginated.map((file) => {
                  const isSelected = selectedId === file.id;
                  const isChecked = selectedIds.includes(file.id);
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => setSelectedId(file.id)}
                      className={cn(
                        "group relative overflow-hidden rounded-xl border bg-card text-left transition-premium",
                        isSelected
                          ? "border-primary ring-2 ring-primary/20"
                          : "border-border"
                      )}
                    >
                      <div className="absolute top-2 left-2 z-10">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggleSelect(file.id)}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Select ${file.name}`}
                        />
                      </div>
                      <div className="relative aspect-square bg-muted">
                        <MediaThumbnail
                          src={file.url}
                          alt={file.alt || file.name}
                          className="object-cover"
                          sizes="200px"
                        />
                      </div>
                      <div className="space-y-1 p-3">
                        <p className="truncate text-sm font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)} · {formatRelativeTime(file.createdAt)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={adminShell.tableCard}>
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <Checkbox
                  checked={allPageSelected}
                  onCheckedChange={toggleSelectAllPage}
                  aria-label="Select all on page"
                />
                <span className="text-xs text-muted-foreground">Select page</span>
              </div>
              <div className="divide-y divide-border">
                {paginated.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setSelectedId(file.id)}
                    className={cn(
                      "flex w-full items-center gap-3 p-3 text-left hover:bg-muted/40",
                      selectedId === file.id && "bg-muted/60"
                    )}
                  >
                    <Checkbox
                      checked={selectedIds.includes(file.id)}
                      onCheckedChange={() => toggleSelect(file.id)}
                      onClick={(event) => event.stopPropagation()}
                      aria-label={`Select ${file.name}`}
                    />
                    <div className="relative size-12 overflow-hidden rounded-lg border border-border bg-muted">
                      <MediaThumbnail
                        src={file.url}
                        alt={file.alt || file.name}
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)} · {formatRelativeTime(file.createdAt)}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {file.type}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filtered.length > 0 ? (
            <ListPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          ) : null}
        </div>

        <aside className="hidden min-h-[28rem] overflow-hidden rounded-xl border border-border bg-card shadow-sm xl:block">
          <MediaDetailPanel
            key={selectedFile?.id ?? "empty"}
            file={selectedFile}
            onUpdate={(file) => {
              refresh();
              setSelectedId(file.id);
            }}
            onDelete={(file) =>
              setDeleteTarget({
                ids: [file.id],
                name: file.name,
                inUse: countMediaUsage(file.url) > 0,
              })
            }
          />
        </aside>
      </div>

      <MobileDetailDrawer
        open={Boolean(selectedFile)}
        onClose={() => setSelectedId(null)}
        title={selectedFile?.name ?? "Media details"}
      >
        {selectedFile ? (
          <MediaDetailPanel
            key={selectedFile.id}
            file={selectedFile}
            onUpdate={(file) => {
              refresh();
              setSelectedId(file.id);
            }}
            onDelete={(file) => {
              setSelectedId(null);
              setDeleteTarget({
                ids: [file.id],
                name: file.name,
                inUse: countMediaUsage(file.url) > 0,
              });
            }}
          />
        ) : null}
      </MobileDetailDrawer>

      <MediaUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={(file) => {
          refresh();
          setSelectedId(file.id);
        }}
      />

      <MediaToolsDialog
        open={toolsOpen}
        onOpenChange={setToolsOpen}
        duplicateGroups={duplicateGroups}
        unusedCount={unusedCount}
        onSelectFile={(fileId) => {
          setSelectedId(fileId);
          setToolsOpen(false);
        }}
      />

      <MediaMoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        folders={folders}
        count={selectedIds.length}
        folderId={moveFolderId}
        onFolderChange={setMoveFolderId}
        onConfirm={confirmMove}
      />

      <DeleteMediaDialog
        open={Boolean(deleteTarget)}
        fileName={deleteTarget?.name}
        count={deleteTarget?.ids.length}
        inUse={deleteTarget?.inUse}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </AdminPage>
  );
}
