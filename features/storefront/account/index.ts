export { AccountAuthCard } from "./components/account-auth-card";
export { AccountDemoNotice } from "./components/account-demo-notice";
export { AccountNav } from "./components/account-nav";
export { AccountShell } from "./components/account-shell";
export { AccountOrderStatusBadge } from "./components/account-order-status-badge";
export { AccountLoginPage } from "./pages/account-login-page";
export { AccountRegisterPage } from "./pages/account-register-page";
export { AccountForgotPasswordPage } from "./pages/account-forgot-password-page";
export { AccountOtpPage } from "./pages/account-otp-page";
export { AccountResetPasswordPage } from "./pages/account-reset-password-page";
export { AccountAuthSuccessPage } from "./pages/account-auth-success-page";
export { AccountAuthErrorPage } from "./pages/account-auth-error-page";
export { AccountSessionExpiredPage } from "./pages/account-session-expired-page";
export { AccountDashboardPage } from "./pages/account-dashboard-page";
export { AccountOrdersPage } from "./pages/account-orders-page";
export { AccountAddressesPage } from "./pages/account-addresses-page";
export { AccountProfilePage } from "./pages/account-profile-page";
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
