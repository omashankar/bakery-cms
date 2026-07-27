import {
  listInquiriesController,
  createInquiryController,
  deleteInquiriesController,
} from "@/features/inquiries/server/inquiry.controller";

export const GET = listInquiriesController;
export const POST = createInquiryController;
export const DELETE = deleteInquiriesController;
