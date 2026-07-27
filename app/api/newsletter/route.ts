import {
  listSubscribersController,
  subscribeController,
  deleteSubscribersController,
} from "@/features/newsletter/server/newsletter.controller";

export const GET = listSubscribersController;
export const POST = subscribeController;
export const DELETE = deleteSubscribersController;
