import {
  listOrdersController,
  placeOrderController,
} from "@/features/orders/server/order.controller";

export const GET = listOrdersController;
export const POST = placeOrderController;
