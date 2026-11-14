import { createRoleController, listRolesController } from "@/features/team/server/team.controller";

export const GET = listRolesController;
export const POST = createRoleController;
