import {
  removeAvatarController,
  uploadAvatarController,
} from "@/features/customer-auth/server/customer-auth.controller";

export const POST = uploadAvatarController;
export const DELETE = removeAvatarController;
