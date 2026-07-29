// Customer records are derived from orders, so they are built in the domain
// layer where the server can run the same code over every order.
export {
  buildCustomerRecords,
  type CustomerRecord,
} from "@/features/customers/lib/customer-profiles";

export type { CustomerListFilters } from "./customer-profile-utils";
export { defaultCustomerFilters } from "./customer-profile-utils";

export {
  countActiveCustomerFilters,
  exportCustomersToCsv,
  filterCustomerProfiles,
  getCustomerProfiles,  getCustomerSegmentStats,
} from "./customer-profile-utils";

export type { CustomerProfile, CustomerSpendFilter } from "./customer-profile-utils";
