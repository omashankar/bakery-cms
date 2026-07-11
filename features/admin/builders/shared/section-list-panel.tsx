"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, Reorder, useDragControls } from "framer-motion";
import {
  Award,
  Cake,
  Camera,
  Copy,
  Gift,
  GripVertical,
  Heart,
  HelpCircle,
  Images,
  LayoutGrid,
  Leaf,
  Mail,
  Megaphone,
  Plus,
  Quote,
  Shield,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const iconMap: Record<string, LucideIcon> = {
  Heart,
  Shield,
  Gift,
  Cake,
  Quote,
  Mail,
  HelpCircle,
  Megaphone,
  Sparkles,
  Award,
  LayoutGrid,
  Star: Award,
  TrendingUp,
  Tag,
  Camera,
  Images,
  Leaf,
  Sun,
  Home: Heart,
};

const EDGE_ZONE = 56;
const MAX_SCROLL_SPEED = 12;

export interface BuilderSectionListItem {
  instanceId: string;
  type: string;
  order: number;
  isVisible: boolean;
  background: string;
}

interface SectionListPanelProps<T extends BuilderSectionListItem> {
  sections: T[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string, visible: boolean) => void;
  onReorder: (orderedIds: string[]) => void;
  onAdd?: () => void;
  onDuplicate?: (id: string) => void;
  onRemove?: (id: string) => void;
  resolveEntry: (type: T["type"]) => { label: string; icon: string } | undefined;
  headerExtra?: ReactNode;
  emptyMessage?: string;
  reorderEnabled?: boolean;
  totalCount?: number;
}

interface SortableRowProps<T extends BuilderSectionListItem> {
  section: T;
  selected: boolean;
  reorderEnabled: boolean;
  canRemove: boolean;
  onSelect: (id: string) => void;
  onToggleVisible: (id: string, visible: boolean) => void;
  onDuplicate?: (id: string) => void;
  onRemove?: (id: string) => void;
  resolveEntry: (type: T["type"]) => { label: string; icon: string } | undefined;
  onDragActiveChange: (active: boolean, clientY?: number) => void;
  onDragMove: (clientY: number) => void;
}

function getClientY(
  event: MouseEvent | TouchEvent | PointerEvent
): number | undefined {
  if ("clientY" in event && typeof event.clientY === "number") {
    return event.clientY;
  }
  if ("touches" in event && event.touches[0]) {
    return event.touches[0].clientY;
  }
  if ("changedTouches" in event && event.changedTouches[0]) {
    return event.changedTouches[0].clientY;
  }
  return undefined;
}

function SortableSectionRow<T extends BuilderSectionListItem>({
  section,
  selected,
  reorderEnabled,
  canRemove,
  onSelect,
  onToggleVisible,
  onDuplicate,
  onRemove,
  resolveEntry,
  onDragActiveChange,
  onDragMove,
}: SortableRowProps<T>) {
  const controls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);
  const entry = resolveEntry(section.type);
  const Icon = iconMap[entry?.icon ?? "Heart"] ?? Heart;

  return (
    <Reorder.Item
      value={section.instanceId}
      dragListener={false}
      dragControls={controls}
      drag={reorderEnabled}
      as="div"
      initial={false}
      transition={{ duration: 0.15, ease: "easeOut" }}
      whileDrag={{
        zIndex: 20,
        boxShadow: "0 1px 3px rgba(45, 45, 45, 0.14)",
      }}
      onDragStart={(event) => {
        setIsDragging(true);
        onDragActiveChange(true, getClientY(event));
      }}
      onDrag={(event) => {
        const y = getClientY(event);
        if (typeof y === "number") onDragMove(y);
      }}
      onDragEnd={() => {
        setIsDragging(false);
        onDragActiveChange(false);
      }}
      className={cn(
        "group relative rounded-lg border bg-card px-2 py-2",
        selected
          ? "border-primary bg-primary/10"
          : "border-border/80 hover:border-primary/40",
        !section.isVisible && !isDragging && "opacity-55",
        isDragging && "cursor-grabbing border-primary/50 bg-card",
        !isDragging && "transition-colors"
      )}
      style={{ listStyle: "none" }}
    >
      <div className="flex items-center gap-1.5">
        {reorderEnabled ? (
          <button
            type="button"
            aria-label={`Drag to reorder ${entry?.label ?? "section"}`}
            title="Drag to reorder"
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground",
              "touch-none select-none hover:bg-muted hover:text-foreground",
              "cursor-grab active:cursor-grabbing"
            )}
            onPointerDown={(event) => {
              controls.start(event);
            }}
          >
            <GripVertical className="size-4" />
          </button>
        ) : (
          <span className="size-8 shrink-0" />
        )}

        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => onSelect(section.instanceId)}
        >
          <Icon className="size-3.5 shrink-0 text-primary" />
          <span className="truncate text-sm font-medium">
            {entry?.label ?? section.type}
          </span>
          {!section.isVisible ? (
            <span className="shrink-0 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Hidden
            </span>
          ) : null}
        </button>

        <Switch
          checked={section.isVisible}
          onCheckedChange={(checked) =>
            onToggleVisible(section.instanceId, checked)
          }
          aria-label={`Toggle ${entry?.label}`}
        />
      </div>

      {(onDuplicate || onRemove) && !isDragging ? (
        <div
          className={cn(
            "mt-1 flex justify-end gap-0.5 transition-opacity",
            selected
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
          )}
        >
          {onDuplicate ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={() => onDuplicate(section.instanceId)}
            >
              <Copy className="size-3.5" />
              Duplicate
            </Button>
          ) : null}
          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-destructive hover:text-destructive"
              onClick={() => onRemove(section.instanceId)}
              disabled={!canRemove}
            >
              <Trash2 className="size-3.5" />
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}
    </Reorder.Item>
  );
}

export function SectionListPanel<T extends BuilderSectionListItem>({
  sections,
  selectedId,
  onSelect,
  onToggleVisible,
  onReorder,
  onAdd,
  onDuplicate,
  onRemove,
  resolveEntry,
  headerExtra,
  emptyMessage = "No sections match this filter.",
  reorderEnabled = true,
  totalCount,
}: SectionListPanelProps<T>) {
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const orderedIds = sorted.map((section) => section.instanceId);
  const layoutCount = totalCount ?? sections.length;
  const canRemove = layoutCount > 1;

  const scrollRef = useRef<HTMLDivElement>(null);
  const pointerYRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const stopAutoScroll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tickAutoScroll = useCallback(() => {
    const el = scrollRef.current;
    const y = pointerYRef.current;

    if (!el || y === null || !draggingRef.current) {
      rafRef.current = null;
      return;
    }

    const rect = el.getBoundingClientRect();
    let delta = 0;

    if (y < rect.top + EDGE_ZONE) {
      const intensity = Math.min(1, Math.max(0, (rect.top + EDGE_ZONE - y) / EDGE_ZONE));
      delta = -Math.ceil(MAX_SCROLL_SPEED * intensity);
    } else if (y > rect.bottom - EDGE_ZONE) {
      const intensity = Math.min(
        1,
        Math.max(0, (y - (rect.bottom - EDGE_ZONE)) / EDGE_ZONE)
      );
      delta = Math.ceil(MAX_SCROLL_SPEED * intensity);
    }

    if (delta !== 0) {
      const prev = el.scrollTop;
      el.scrollTop = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, prev + delta));
    }

    rafRef.current = requestAnimationFrame(tickAutoScroll);
  }, []);

  const handleDragMove = useCallback((clientY: number) => {
    pointerYRef.current = clientY;
  }, []);

  const handleDragActiveChange = useCallback(
    (active: boolean, clientY?: number) => {
      draggingRef.current = active;

      if (!active) {
        pointerYRef.current = null;
        stopAutoScroll();
        return;
      }

      if (typeof clientY === "number") {
        pointerYRef.current = clientY;
      }

      stopAutoScroll();
      rafRef.current = requestAnimationFrame(tickAutoScroll);
    },
    [stopAutoScroll, tickAutoScroll]
  );

  useEffect(() => {
    function onPointerMove(event: PointerEvent) {
      if (!draggingRef.current) return;
      pointerYRef.current = event.clientY;
    }

    function onPointerUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      pointerYRef.current = null;
      stopAutoScroll();
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      stopAutoScroll();
    };
  }, [stopAutoScroll]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 border-b border-border px-3 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">Sections</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {sorted.length}
          </p>
        </div>
        {headerExtra}
        <p className="text-[11px] text-muted-foreground">
          {reorderEnabled
            ? "Drag handle to reorder"
            : "Show All to reorder sections"}
        </p>
      </div>

      <motion.div
        ref={scrollRef}
        layoutScroll
        className="panel-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
      >
        {sorted.length === 0 ? (
          <p className="px-2 py-8 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </p>
        ) : reorderEnabled ? (
          <Reorder.Group
            axis="y"
            values={orderedIds}
            onReorder={onReorder}
            className="flex flex-col gap-1.5"
            as="div"
          >
            {sorted.map((section) => (
              <SortableSectionRow
                key={section.instanceId}
                section={section}
                selected={selectedId === section.instanceId}
                reorderEnabled={reorderEnabled}
                canRemove={canRemove}
                onSelect={onSelect}
                onToggleVisible={onToggleVisible}
                onDuplicate={onDuplicate}
                onRemove={onRemove}
                resolveEntry={resolveEntry}
                onDragActiveChange={handleDragActiveChange}
                onDragMove={handleDragMove}
              />
            ))}
          </Reorder.Group>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sorted.map((section) => {
              const entry = resolveEntry(section.type);
              const Icon = iconMap[entry?.icon ?? "Heart"] ?? Heart;
              const isSelected = selectedId === section.instanceId;

              return (
                <div
                  key={section.instanceId}
                  className={cn(
                    "rounded-lg border px-2 py-2",
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border/80",
                    !section.isVisible && "opacity-55"
                  )}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="size-8 shrink-0" />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => onSelect(section.instanceId)}
                    >
                      <Icon className="size-3.5 shrink-0 text-primary" />
                      <span className="truncate text-sm font-medium">
                        {entry?.label ?? section.type}
                      </span>
                    </button>
                    <Switch
                      checked={section.isVisible}
                      onCheckedChange={(checked) =>
                        onToggleVisible(section.instanceId, checked)
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {onAdd ? (
        <div className="shrink-0 border-t border-border p-2.5">
          <Button type="button" variant="outline" className="w-full" size="sm" onClick={onAdd}>
            <Plus className="size-4" />
            Add section
          </Button>
        </div>
      ) : null}
    </div>
  );
}
