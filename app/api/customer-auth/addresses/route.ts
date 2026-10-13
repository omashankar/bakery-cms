import {
  myAddressesController,
  saveMyAddressesController,
} from "@/features/customer-auth/server/customer-auth.controller";

export const GET = myAddressesController;
export const PUT = saveMyAddressesController;
