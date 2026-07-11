/** Shared admin shell dimensions and surface tokens */
export const adminShell = {
  chromeHeight: "h-14",
  /** 256px — standard admin sidebar width */
  sidebarWidth: "w-64",
  sidebarWidthPx: 256,
  sidebarCollapsedWidth: "w-16",
  border: "border-sidebar-border",
  header: "border-b border-sidebar-border bg-background shadow-sm",
  sidebarBg: "bg-sidebar",
  pageBg: "bg-background",
  /** Horizontal inset shared by header + page content for perfect alignment */
  contentWrap: "w-full px-4 sm:px-5 lg:px-6",
  mainPadding: "py-4 sm:py-5 lg:py-6",
  /** Vertical stack rhythm for feature pages */
  pageStack: "space-y-6",
  /** Filter / toolbar card */
  filterCard: "rounded-xl border border-border bg-card p-4 shadow-sm",
  /** Stat summary tile */
  statCard: "rounded-xl border border-border bg-card px-4 py-3 shadow-sm",
  /** Table container with horizontal scroll on narrow viewports */
  tableCard: "overflow-hidden rounded-xl border border-border bg-card shadow-sm",
  tableScroll: "overflow-x-auto",
  /** Sticky save/actions bar on mobile — compensates contentWrap inset */
  mobileActionBar:
    "sticky bottom-0 z-10 -mx-4 flex flex-wrap items-start justify-between gap-4 border-t border-border bg-background px-4 py-4 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0",
  iconButton:
    "size-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
  navRow:
    "flex h-9 w-full items-center rounded-md text-[13px] font-medium transition-premium",
  navActive: "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm",
  /** Table / list row hover */
  rowHover: "hover:bg-muted",
  /** Primary text link in tables */
  rowTitle: "font-medium text-foreground hover:text-primary",
  /** Warning callout — theme-aware */
  alertWarning:
    "border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100",
  /** Destructive callout — theme-aware */
  alertDestructive:
    "border-red-200/80 bg-red-50 text-red-950 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-100",
  /** Success / positive tone for outline badges */
  tonePositive:
    "border-green-200 bg-green-50 text-green-900 dark:border-green-500/30 dark:bg-green-950/40 dark:text-green-100",
  toneWarning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100",
  toneInfo:
    "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-100",
  toneDestructive:
    "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-100",
  /** Metric delta text */
  textPositive: "text-green-700 dark:text-green-400",
  textWarning: "text-amber-700 dark:text-amber-400",
} as const;
