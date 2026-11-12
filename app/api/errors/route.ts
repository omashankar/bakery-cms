import {
  listErrorsController,
  reportBrowserErrorController,
} from "@/features/error-log/server/error-log.controller";

export const GET = listErrorsController;
export const POST = reportBrowserErrorController;
