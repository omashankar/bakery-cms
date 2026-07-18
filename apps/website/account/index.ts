export { AccountNav } from "./components/account-nav";
export { AccountShell } from "./components/account-shell";
export { AccountOrderStatusBadge } from "./components/account-order-status-badge";
export { CustomerAuthModal, openCustomerAuthModal } from "./components/customer-auth-modal";
export { AccountDashboardPage } from "./pages/account-dashboard-page";
export { AccountOrdersPage } from "./pages/account-orders-page";
export { AccountAddressesPage } from "./pages/account-addresses-page";
export { useCustomerAuth } from "./hooks/use-customer-auth";
export {
  setCustomerSession,
  getCustomerSession,
  clearCustomerSession,
  hasCustomerSession,
  getCustomerDisplayName,
  updateCustomerProfile,
} from "./lib/customer-session";
export {
  getSavedAddresses,
  getDefaultAddress,
  createSavedAddress,
  updateSavedAddress,
  deleteSavedAddress,
  setDefaultSavedAddress,
} from "./lib/customer-addresses";
export type { CustomerSession } from "./lib/customer-session";
export type { SavedAddress } from "./lib/customer-addresses";
