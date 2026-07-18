/** Reports feature module — Phase 19 */
export { ReportsPage } from "./components/reports-page";
export {
  loadReportOrders,
  getReportsSummary,
  getRevenueTrend,
  getTopProducts,
  getTopCustomers,
  exportReportsCsv,
  type ReportDateRange,
} from "./lib/reports-data";
