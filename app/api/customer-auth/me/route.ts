import {
  customerMeController,
  deleteMyAccountController,
} from "@/features/customer-auth/server/customer-auth.controller";

export const GET = customerMeController;
export const DELETE = deleteMyAccountController;
