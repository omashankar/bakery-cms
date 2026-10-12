// What the dashboard opens on. Plain values, no browser stores: the server page
// reads the same view for its first render, so the two cannot disagree.

/** How many entries the activity card shows. */
export const DASHBOARD_FEED_LIMIT = 5;

/** How many orders the Recent orders card shows. */
export const DASHBOARD_RECENT_ORDERS = 4;

/** The range the figures open on. */
export const DEFAULT_DASHBOARD_RANGE = "30d" as const;
